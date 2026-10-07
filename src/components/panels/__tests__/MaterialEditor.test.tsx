// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaterialEditor } from '../MaterialEditor';
import { useModelStore } from '../../../store/model-store';
import { useUIStore } from '../../../store/ui-store';

beforeEach(() => {
  useUIStore.setState(useUIStore.getInitialState(), true);
  useModelStore.getState().clearModel();
  useModelStore.setState({ materials: [] });
});

function card(name: string) {
  return screen.getByRole('button', { name: new RegExp(`^${name}`) });
}

describe('MaterialEditor library cards', () => {
  it('shows imperial strengths as before', async () => {
    useUIStore.setState({ unitSystem: 'imperial' });
    render(<MaterialEditor />);

    expect(card('A992 Gr.50')).toHaveTextContent('Fy=50 ksi');

    await userEvent.click(screen.getByRole('button', { name: /concrete/i }));
    expect(card("f'c 4 ksi")).toHaveTextContent('4000 psi');
    expect(card("f'c 4 ksi")).toHaveTextContent('E=3605 ksi');
  });

  it('converts the cards to MPa in metric', async () => {
    useUIStore.setState({ unitSystem: 'metric' });
    render(<MaterialEditor />);

    expect(card('A992 Gr.50')).toHaveTextContent('Fy=345 MPa');
    expect(card('A992 Gr.50')).not.toHaveTextContent('ksi');

    await userEvent.click(screen.getByRole('button', { name: /concrete/i }));
    expect(card("f'c 4 ksi")).toHaveTextContent("f'c 27.6 MPa");
    expect(card("f'c 4 ksi")).toHaveTextContent('E=24856 MPa');
    expect(card("f'c 4 ksi")).not.toHaveTextContent('psi');
  });

  it('stores a custom metric material in ksi', async () => {
    useUIStore.setState({ unitSystem: 'metric' });
    render(<MaterialEditor />);
    await userEvent.click(screen.getByRole('button', { name: /custom/i }));

    await userEvent.type(screen.getByPlaceholderText('e.g. A992 Steel'), 'S355');
    const fy = screen.getByLabelText(/^Fy \(MPa\)/);
    await userEvent.clear(fy);
    await userEvent.type(fy, '355');
    await userEvent.click(screen.getByRole('button', { name: /add custom material/i }));

    const added = useModelStore.getState().materials.find((m) => m.name === 'S355');
    expect(added?.fy).toBeCloseTo(51.488, 3);
  });
});
