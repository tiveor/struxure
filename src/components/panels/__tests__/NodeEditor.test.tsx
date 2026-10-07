// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeEditor } from '../NodeEditor';
import { useModelStore } from '../../../store/model-store';
import { useUIStore } from '../../../store/ui-store';

const NODES = [
  { id: 'N1', x: 0, y: 0, z: 0 },
  { id: 'N2', x: 120, y: 0, z: 0 },
  { id: 'N3', x: 120, y: 144, z: 36 },
];

/**
 * The coordinate labels are not associated with their inputs yet, so
 * getByLabelText cannot reach them. The spinbuttons render in X, Y, Z order.
 */
function coordinateInputs() {
  const [x, y, z] = screen.getAllByRole('spinbutton');
  return { x, y, z };
}

function row(id: string) {
  return screen.getByRole('row', { name: new RegExp(`^${id}\\b`) });
}

/** The element that scrolls the node list. */
function listScroller() {
  return screen.getByRole('table').parentElement as HTMLElement;
}

beforeEach(() => {
  useUIStore.setState(useUIStore.getInitialState(), true);
  useUIStore.setState({ unitSystem: 'imperial' });
  useModelStore.getState().clearModel();
  useModelStore.setState({ nodes: NODES.map((n) => ({ ...n })) });
});

describe('NodeEditor', () => {
  it('fills the form with the values of whichever node is selected', async () => {
    render(<NodeEditor />);

    await userEvent.click(row('N2'));
    expect(screen.getByRole('heading', { name: /edit node.*N2/i })).toBeInTheDocument();
    expect(coordinateInputs().x).toHaveValue(120);
    expect(coordinateInputs().y).toHaveValue(0);
    expect(coordinateInputs().z).toHaveValue(0);

    await userEvent.click(row('N3'));
    expect(screen.getByRole('heading', { name: /edit node.*N3/i })).toBeInTheDocument();
    expect(coordinateInputs().x).toHaveValue(120);
    expect(coordinateInputs().y).toHaveValue(144);
    expect(coordinateInputs().z).toHaveValue(36);
  });

  it('discards unsaved edits when another node is selected', async () => {
    render(<NodeEditor />);

    await userEvent.click(row('N2'));
    await userEvent.clear(coordinateInputs().x);
    await userEvent.type(coordinateInputs().x, '999');

    await userEvent.click(row('N1'));

    expect(coordinateInputs().x).toHaveValue(0);
    expect(useModelStore.getState().nodes.find((n) => n.id === 'N2')?.x).toBe(120);
  });

  it('keeps the list scroll position when a row is selected', async () => {
    render(<NodeEditor />);
    const scroller = listScroller();
    scroller.scrollTop = 240;

    await userEvent.click(row('N3'));
    await userEvent.click(row('N2'));

    // Remounting the list (a `key` on the whole editor) would replace this
    // element with a fresh one scrolled back to the top.
    expect(listScroller()).toBe(scroller);
    expect(listScroller().scrollTop).toBe(240);
  });

  it('clears the form after deleting the selected node from the form', async () => {
    render(<NodeEditor />);
    await userEvent.click(row('N3'));
    expect(coordinateInputs().y).toHaveValue(144);

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(useModelStore.getState().nodes.map((n) => n.id)).toEqual(['N1', 'N2']);
    expect(screen.getByRole('heading', { name: /add node/i })).toBeInTheDocument();
    const { x, y, z } = coordinateInputs();
    expect(x).toHaveValue(0);
    expect(y).toHaveValue(0);
    expect(z).toHaveValue(0);
  });

  it('clears the form after deleting the selected node from its list row', async () => {
    render(<NodeEditor />);
    await userEvent.click(row('N3'));
    expect(coordinateInputs().y).toHaveValue(144);

    await userEvent.click(within(row('N3')).getByTitle('Delete node'));

    expect(useModelStore.getState().nodes.map((n) => n.id)).toEqual(['N1', 'N2']);
    expect(useUIStore.getState().selectedNodeId).toBeNull();
    expect(screen.getByRole('heading', { name: /add node/i })).toBeInTheDocument();
    expect(coordinateInputs().y).toHaveValue(0);
    expect(coordinateInputs().z).toHaveValue(0);
  });

  it('moves the node when X is edited and Update is pressed', async () => {
    render(<NodeEditor />);
    await userEvent.click(row('N2'));

    await userEvent.clear(coordinateInputs().x);
    await userEvent.type(coordinateInputs().x, '240');
    await userEvent.click(screen.getByRole('button', { name: /update node/i }));

    expect(useModelStore.getState().nodes.find((n) => n.id === 'N2')).toEqual({
      id: 'N2',
      x: 240,
      y: 0,
      z: 0,
    });
    expect(within(row('N2')).getByText('(240.0, 0.0, 0.0)')).toBeInTheDocument();
  });

  it('adds a node from the empty form', async () => {
    render(<NodeEditor />);

    await userEvent.type(screen.getByPlaceholderText('Auto-generate ID'), 'N9');
    await userEvent.clear(coordinateInputs().y);
    await userEvent.type(coordinateInputs().y, '60');
    await userEvent.click(screen.getByRole('button', { name: /add node/i }));

    expect(useModelStore.getState().nodes.at(-1)).toEqual({ id: 'N9', x: 0, y: 60, z: 0 });
    expect(row('N9')).toBeInTheDocument();
  });
});

describe('NodeEditor, metric units', () => {
  it('shows coordinates in metres and stores typed metres as inches', async () => {
    useUIStore.setState({ unitSystem: 'metric' });
    render(<NodeEditor />);

    expect(screen.getByRole('columnheader', { name: /coordinates.*\(m\)/i })).toBeInTheDocument();
    expect(within(row('N3')).getByText('(3.048, 3.658, 0.914)')).toBeInTheDocument();

    await userEvent.click(row('N2'));
    expect(coordinateInputs().x).toHaveValue(3.048);

    await userEvent.clear(coordinateInputs().x);
    await userEvent.type(coordinateInputs().x, '6.096');
    await userEvent.click(screen.getByRole('button', { name: /update node/i }));

    expect(useModelStore.getState().nodes.find((n) => n.id === 'N2')?.x).toBeCloseTo(240, 10);
  });

  it('keeps an unsaved edit correct when the unit system changes mid-edit', async () => {
    render(<NodeEditor />);
    await userEvent.click(row('N2'));
    await userEvent.clear(coordinateInputs().x);
    await userEvent.type(coordinateInputs().x, '240');

    act(() => useUIStore.setState({ unitSystem: 'metric' }));

    // The draft is re-shown in metres rather than reinterpreted as 240 m.
    expect(coordinateInputs().x).toHaveValue(6.096);
    await userEvent.click(screen.getByRole('button', { name: /update node/i }));
    expect(useModelStore.getState().nodes.find((n) => n.id === 'N2')?.x).toBeCloseTo(240, 10);
  });
});
