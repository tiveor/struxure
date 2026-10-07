// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoadEditor } from '../LoadEditor';
import { useModelStore } from '../../../store/model-store';
import { useUIStore } from '../../../store/ui-store';

beforeEach(() => {
  useUIStore.setState(useUIStore.getInitialState(), true);
  useUIStore.setState({ unitSystem: 'imperial' });
  useModelStore.getState().clearModel();
  useModelStore.setState({
    nodes: [
      { id: 'N1', x: 0, y: 0, z: 0 },
      { id: 'N2', x: 120, y: 0, z: 0 },
    ],
    elements: [{ id: 'E1', nodeI: 'N1', nodeJ: 'N2', materialId: 'm', sectionId: 's', betaAngle: 0 }],
    nodalLoads: [],
    distributedLoads: [],
  });
});

async function typeInto(label: string, value: string) {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, value);
}

describe('LoadEditor', () => {
  it('lists applied moments next to forces, with units in both headers', () => {
    useModelStore.setState({
      nodalLoads: [{ id: 'L1', nodeId: 'N2', fx: 0, fy: -10, fz: 0, mx: 0, my: 0, mz: 120 }],
    });
    render(<LoadEditor />);

    expect(screen.getByRole('columnheader', { name: 'Forces (kip)' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Moments (kip-in)' })).toBeInTheDocument();
    const loadRow = screen.getByRole('row', { name: /^L1\b/ });
    expect(within(loadRow).getByText('(0.0, -10.0, 0.0)')).toBeInTheDocument();
    expect(within(loadRow).getByText('(0.0, 0.0, 120.0)')).toBeInTheDocument();
  });

  it('shows the lists in kN, kN-m and kN/m in metric', async () => {
    useUIStore.setState({ unitSystem: 'metric' });
    useModelStore.setState({
      nodalLoads: [{ id: 'L1', nodeId: 'N2', fx: 0, fy: -10, fz: 0, mx: 0, my: 0, mz: 120 }],
      distributedLoads: [{ id: 'DL1', elementId: 'E1', wx: 0, wy: -0.1, wz: 0 }],
    });
    render(<LoadEditor />);

    expect(screen.getByRole('columnheader', { name: 'Forces (kN)' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Moments (kN-m)' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'W (kN/m)' })).toBeInTheDocument();
    expect(screen.getByText('(0.0, -44.5, 0.0)')).toBeInTheDocument();
    expect(screen.getByText('(0.0, 0.0, 13.6)')).toBeInTheDocument();
    expect(screen.getByText('(0.00, -17.51, 0.00)')).toBeInTheDocument();
  });

  it('stores a metric nodal load in kip and kip-in', async () => {
    useUIStore.setState({ unitSystem: 'metric' });
    render(<LoadEditor />);

    await userEvent.selectOptions(screen.getByLabelText('Node'), 'N2');
    await typeInto('Fy', '-44.48');
    await typeInto('Mz', '13.56');
    await userEvent.click(screen.getByRole('button', { name: /add nodal load/i }));

    const load = useModelStore.getState().nodalLoads[0];
    expect(load.fy).toBeCloseTo(-10, 3);
    expect(load.mz).toBeCloseTo(120, 1);
  });

  it('stores a 1.5 kN/m distributed load without rounding it away', async () => {
    useUIStore.setState({ unitSystem: 'metric' });
    render(<LoadEditor />);

    await userEvent.click(screen.getByRole('button', { name: /distributed/i }));
    await userEvent.selectOptions(screen.getByLabelText('Element'), 'E1');
    await typeInto('Wy', '-1.5');
    await userEvent.click(screen.getByRole('button', { name: /add distributed load/i }));

    expect(useModelStore.getState().distributedLoads[0].wy).toBeCloseTo(-1.5 / 175.126835, 9);
    expect(screen.getByText('(0.00, -1.50, 0.00)')).toBeInTheDocument();
  });

  it('keeps a typed draft correct when the unit system changes mid-edit', async () => {
    render(<LoadEditor />);
    await userEvent.selectOptions(screen.getByLabelText('Node'), 'N2');
    await typeInto('Fx', '10');

    act(() => useUIStore.setState({ unitSystem: 'metric' }));

    expect(screen.getByLabelText('Fx')).toHaveValue(44.48221615);
    await userEvent.click(screen.getByRole('button', { name: /add nodal load/i }));
    expect(useModelStore.getState().nodalLoads[0].fx).toBeCloseTo(10, 6);
  });
});
