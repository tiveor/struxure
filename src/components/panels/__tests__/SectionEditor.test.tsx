// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SectionEditor } from '../SectionEditor';
import { useModelStore } from '../../../store/model-store';
import { useUIStore } from '../../../store/ui-store';

beforeEach(() => {
  useUIStore.setState(useUIStore.getInitialState(), true);
  useUIStore.setState({ unitSystem: 'imperial' });
  useModelStore.getState().clearModel();
  useModelStore.setState({ sections: [] });
});

async function setNumber(label: RegExp, value: string) {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, value);
}

describe('SectionEditor', () => {
  it('reaches every custom section input through its label', () => {
    render(<SectionEditor />);
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^A \(/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Ix \(/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Iy \(/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^J \(/)).toBeInTheDocument();
  });

  it('shows b, h and the reinforcement inputs for a rectangular concrete section', async () => {
    render(<SectionEditor />);
    expect(screen.queryByLabelText(/^b \(/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/rectangular concrete/i));
    expect(screen.getByLabelText(/^b \(in\)/)).toHaveValue(16);
    expect(screen.getByLabelText(/^h \(in\)/)).toHaveValue(16);
    expect(screen.queryByLabelText(/^A \(/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/bar size/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/column reinforcement/i));
    expect(screen.getByLabelText(/bar size/i)).toHaveValue('8');
    expect(screen.getByLabelText(/tie size/i)).toHaveValue('3');
    expect(screen.getByLabelText(/bars per b face/i)).toHaveValue(3);
    expect(screen.getByLabelText(/bars per h face/i)).toHaveValue(3);
    expect(screen.getByLabelText(/clear cover/i)).toHaveValue(1.5);
    expect(screen.getByLabelText(/rebar fy/i)).toHaveValue(60);
    expect(screen.getByText(/8 bars, As = 6\.32/)).toBeInTheDocument();
  });

  it('adds a reinforced section with its b x h properties', async () => {
    render(<SectionEditor />);
    await userEvent.type(screen.getByLabelText(/^name$/i), 'C12x20');
    await userEvent.click(screen.getByLabelText(/rectangular concrete/i));
    await setNumber(/^b \(in\)/, '12');
    await setNumber(/^h \(in\)/, '20');
    await userEvent.click(screen.getByLabelText(/column reinforcement/i));
    await userEvent.selectOptions(screen.getByLabelText(/bar size/i), '9');
    await setNumber(/bars per h face/i, '2');
    await userEvent.click(screen.getByRole('button', { name: /add section/i }));

    const [s] = useModelStore.getState().sections;
    expect(s.name).toBe('C12x20');
    expect(s.b).toBe(12);
    expect(s.h).toBe(20);
    expect(s.A).toBe(240);
    expect(s.Ix).toBeCloseTo((12 * 20 ** 3) / 12, 10);
    expect(s.Iy).toBeCloseTo((20 * 12 ** 3) / 12, 10);
    expect(s.reinforcement).toEqual({
      cover: 1.5, barSize: 9, tieSize: 3, barsAlongB: 3, barsAlongH: 2, fy: 60,
    });
    expect(screen.getByText('6 #9, #3 ties')).toBeInTheDocument();
  });

  it('adds a plain rectangular section without reinforcement', async () => {
    render(<SectionEditor />);
    await userEvent.type(screen.getByLabelText(/^name$/i), 'B12x24');
    await userEvent.click(screen.getByLabelText(/rectangular concrete/i));
    await setNumber(/^b \(in\)/, '12');
    await setNumber(/^h \(in\)/, '24');
    await userEvent.click(screen.getByRole('button', { name: /add section/i }));

    const [s] = useModelStore.getState().sections;
    expect(s.A).toBe(288);
    expect(s).not.toHaveProperty('reinforcement');
  });

  it('blocks a layout that does not fit and says why', async () => {
    render(<SectionEditor />);
    await userEvent.type(screen.getByLabelText(/^name$/i), 'Tiny');
    await userEvent.click(screen.getByLabelText(/rectangular concrete/i));
    await userEvent.click(screen.getByLabelText(/column reinforcement/i));
    await setNumber(/bars per b face/i, '14');

    expect(screen.getByRole('alert')).toHaveTextContent(/overlap/);
    expect(screen.getByRole('button', { name: /add section/i })).toBeDisabled();
    expect(useModelStore.getState().sections).toHaveLength(0);
  });
});
