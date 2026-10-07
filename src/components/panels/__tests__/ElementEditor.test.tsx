// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ElementEditor } from '../ElementEditor';
import { useModelStore } from '../../../store/model-store';
import { useUIStore } from '../../../store/ui-store';
import type { FrameElement } from '../../../core/types';

const STEEL = 'steel-A992';
const CONCRETE = 'concrete-4000';

const ELEMENTS: FrameElement[] = [
  { id: 'E1', nodeI: 'N1', nodeJ: 'N2', materialId: STEEL, sectionId: 'W12x26', betaAngle: 0 },
  { id: 'E2', nodeI: 'N2', nodeJ: 'N3', materialId: CONCRETE, sectionId: 'W12x26', betaAngle: 0 },
];

/**
 * The field labels are not associated with their selects yet, so
 * getByLabelText cannot reach them. The comboboxes render in
 * Node I, Node J, Material, Section order.
 */
function fields() {
  const [nodeI, nodeJ, material, section] = screen.getAllByRole('combobox');
  return { nodeI, nodeJ, material, section };
}

function row(id: string) {
  return screen.getByRole('row', { name: new RegExp(`^${id}\\b`) });
}

/** The element that scrolls the element list. */
function listScroller() {
  return screen.getByRole('table').parentElement as HTMLElement;
}

beforeEach(() => {
  useUIStore.setState(useUIStore.getInitialState(), true);
  useModelStore.getState().clearModel();
  useModelStore.setState({
    nodes: [
      { id: 'N1', x: 0, y: 0, z: 0 },
      { id: 'N2', x: 120, y: 0, z: 0 },
      { id: 'N3', x: 240, y: 0, z: 0 },
      { id: 'N4', x: 360, y: 0, z: 0 },
    ],
    elements: ELEMENTS.map((e) => ({ ...e })),
  });
});

describe('ElementEditor', () => {
  it('fills the form with the values of whichever element is selected', async () => {
    render(<ElementEditor />);

    await userEvent.click(row('E1'));
    expect(screen.getByRole('heading', { name: /edit element.*E1/i })).toBeInTheDocument();
    expect(fields().nodeI).toHaveValue('N1');
    expect(fields().nodeJ).toHaveValue('N2');
    expect(fields().material).toHaveValue(STEEL);

    await userEvent.click(row('E2'));
    expect(screen.getByRole('heading', { name: /edit element.*E2/i })).toBeInTheDocument();
    expect(fields().nodeI).toHaveValue('N2');
    expect(fields().nodeJ).toHaveValue('N3');
    expect(fields().material).toHaveValue(CONCRETE);
  });

  it('keeps the list scroll position when a row is selected', async () => {
    render(<ElementEditor />);
    const scroller = listScroller();
    scroller.scrollTop = 180;

    await userEvent.click(row('E2'));
    await userEvent.click(row('E1'));

    // Remounting the list (a `key` on the whole editor) would replace this
    // element with a fresh one scrolled back to the top.
    expect(listScroller()).toBe(scroller);
    expect(listScroller().scrollTop).toBe(180);
  });

  it('clears the form after deleting the selected element from the form', async () => {
    render(<ElementEditor />);
    await userEvent.click(row('E2'));
    expect(fields().nodeI).toHaveValue('N2');

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(useModelStore.getState().elements.map((e) => e.id)).toEqual(['E1']);
    expect(screen.getByRole('heading', { name: /add element/i })).toBeInTheDocument();
    const { nodeI, nodeJ, material } = fields();
    expect(nodeI).toHaveValue('');
    expect(nodeJ).toHaveValue('');
    expect(material).toHaveValue(STEEL);
  });

  it('clears the form after deleting the selected element from its list row', async () => {
    render(<ElementEditor />);
    await userEvent.click(row('E2'));
    expect(fields().nodeI).toHaveValue('N2');

    await userEvent.click(within(row('E2')).getByTitle('Delete element'));

    expect(useModelStore.getState().elements.map((e) => e.id)).toEqual(['E1']);
    expect(useUIStore.getState().selectedElementId).toBeNull();
    expect(screen.getByRole('heading', { name: /add element/i })).toBeInTheDocument();
    expect(fields().nodeI).toHaveValue('');
    expect(fields().nodeJ).toHaveValue('');
  });

  it('reconnects and re-materials the element when Update is pressed', async () => {
    render(<ElementEditor />);
    await userEvent.click(row('E1'));

    await userEvent.selectOptions(fields().nodeJ, 'N4');
    await userEvent.selectOptions(fields().material, CONCRETE);
    await userEvent.click(screen.getByRole('button', { name: /update element/i }));

    expect(useModelStore.getState().elements.find((e) => e.id === 'E1')).toMatchObject({
      nodeI: 'N1',
      nodeJ: 'N4',
      materialId: CONCRETE,
    });
    expect(within(row('E1')).getByText('N1 → N4')).toBeInTheDocument();
  });

  it('adds an element between two chosen nodes', async () => {
    render(<ElementEditor />);

    await userEvent.selectOptions(fields().nodeI, 'N3');
    await userEvent.selectOptions(fields().nodeJ, 'N4');
    await userEvent.click(screen.getByRole('button', { name: /add element/i }));

    expect(useModelStore.getState().elements.at(-1)).toMatchObject({
      id: 'E3',
      nodeI: 'N3',
      nodeJ: 'N4',
      materialId: STEEL,
    });
    expect(row('E3')).toBeInTheDocument();
  });
});
