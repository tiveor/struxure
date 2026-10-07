// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
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

const W12X26 = { id: 'W12x26', name: 'W12x26', A: 7.65, Ix: 204, Iy: 17.3, J: 0.3 };

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

  it('accepts a fractional torsional constant such as J = 0.3', async () => {
    render(<SectionEditor />);

    await userEvent.type(screen.getByLabelText(/^name$/i), 'Custom');
    await setNumber(/^J \(/, '0.3');
    expect(screen.getByLabelText(/^J \(/)).toHaveValue(0.3);

    await userEvent.click(screen.getByRole('button', { name: /add section/i }));
    const added = useModelStore.getState().sections.find((s) => s.name === 'Custom');
    expect(added?.J).toBe(0.3);
  });

  it('labels the list columns with units', () => {
    useModelStore.setState({ sections: [W12X26] });
    render(<SectionEditor />);
    expect(screen.getByRole('columnheader', { name: 'A (in²)' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ix (in⁴)' })).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /W12x26/ });
    expect(within(row).getByText('7.65')).toBeInTheDocument();
    expect(within(row).getByText('204')).toBeInTheDocument();
  });

  it('marks a rectangular section as rect', async () => {
    render(<SectionEditor />);
    await userEvent.type(screen.getByLabelText(/^name$/i), 'R');
    await userEvent.click(screen.getByLabelText(/rectangular concrete/i));
    await userEvent.click(screen.getByRole('button', { name: /add section/i }));
    expect(useModelStore.getState().sections[0].shape).toBe('rect');
  });

  it('opens the section library', async () => {
    render(<SectionEditor />);
    await userEvent.click(screen.getByRole('button', { name: /section library/i }));
    expect(screen.getByRole('tab', { name: 'EN' })).toBeInTheDocument();
  });
});

describe('SectionEditor, custom steel I-section', () => {
  it('hides the I-section inputs until asked, then reaches each by its label', async () => {
    render(<SectionEditor />);
    expect(screen.queryByLabelText(/^d \(/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/steel i-section/i));
    expect(screen.getByLabelText(/^d \(in\)/)).toHaveValue(12.2);
    expect(screen.getByLabelText(/^bf \(in\)/)).toHaveValue(6.49);
    expect(screen.getByLabelText(/^tf \(in\)/)).toHaveValue(0.38);
    expect(screen.getByLabelText(/^tw \(in\)/)).toHaveValue(0.23);
    expect(screen.getByLabelText(/^Sx \(in³\)/)).toHaveValue(0);
    expect(screen.getByLabelText(/^Zx \(in³\)/)).toHaveValue(0);
    // Still a plain properties section underneath.
    expect(screen.getByLabelText(/^A \(/)).toBeInTheDocument();
  });

  it('is not offered for a rectangular concrete section', async () => {
    render(<SectionEditor />);
    await userEvent.click(screen.getByLabelText(/rectangular concrete/i));
    expect(screen.queryByLabelText(/steel i-section/i)).not.toBeInTheDocument();
  });

  it('adds an I-section with its dimensions and moduli', async () => {
    render(<SectionEditor />);
    await userEvent.type(screen.getByLabelText(/^name$/i), 'Built-up');
    await setNumber(/^A \(/, '7.65');
    await setNumber(/^Ix \(/, '204');
    await userEvent.click(screen.getByLabelText(/steel i-section/i));
    await setNumber(/^d \(in\)/, '12.2');
    await setNumber(/^Sx \(in³\)/, '33.4');
    await setNumber(/^Zx \(in³\)/, '37.2');
    await userEvent.click(screen.getByRole('button', { name: /add section/i }));

    const [s] = useModelStore.getState().sections;
    expect(s).toMatchObject({
      name: 'Built-up', shape: 'I', A: 7.65, Ix: 204,
      d: 12.2, bf: 6.49, tf: 0.38, tw: 0.23, Sx: 33.4, Zx: 37.2,
    });
  });

  it('leaves Sx and Zx out when they are 0', async () => {
    render(<SectionEditor />);
    await userEvent.type(screen.getByLabelText(/^name$/i), 'NoModuli');
    await userEvent.click(screen.getByLabelText(/steel i-section/i));
    await userEvent.click(screen.getByRole('button', { name: /add section/i }));

    const [s] = useModelStore.getState().sections;
    expect(s.d).toBe(12.2);
    expect(s).not.toHaveProperty('Sx');
    expect(s).not.toHaveProperty('Zx');
  });

  it('blocks flanges thicker than the depth allows', async () => {
    render(<SectionEditor />);
    await userEvent.type(screen.getByLabelText(/^name$/i), 'Bad');
    await userEvent.click(screen.getByLabelText(/steel i-section/i));
    await setNumber(/^tf \(in\)/, '7');

    expect(screen.getByRole('alert')).toHaveTextContent(/thinner than d/);
    expect(screen.getByRole('button', { name: /add section/i })).toBeDisabled();
  });

  it('takes the dimensions in mm and the moduli in mm³ in metric', async () => {
    useUIStore.setState({ unitSystem: 'metric' });
    render(<SectionEditor />);
    await userEvent.type(screen.getByLabelText(/^name$/i), 'IPE-like');
    await userEvent.click(screen.getByLabelText(/steel i-section/i));
    await setNumber(/^d \(mm\)/, '300');
    await setNumber(/^bf \(mm\)/, '150');
    await setNumber(/^tf \(mm\)/, '10.7');
    await setNumber(/^tw \(mm\)/, '7.1');
    await setNumber(/^Sx \(mm³\)/, '557100');
    await setNumber(/^Zx \(mm³\)/, '628400');
    await userEvent.click(screen.getByRole('button', { name: /add section/i }));

    const [s] = useModelStore.getState().sections;
    expect(s.d).toBeCloseTo(300 / 25.4, 12);
    expect(s.bf).toBeCloseTo(150 / 25.4, 12);
    expect(s.tf).toBeCloseTo(10.7 / 25.4, 12);
    expect(s.tw).toBeCloseTo(7.1 / 25.4, 12);
    expect(s.Sx).toBeCloseTo(557100 / 25.4 ** 3, 10);
    expect(s.Zx).toBeCloseTo(628400 / 25.4 ** 3, 10);
  });
});

describe('SectionEditor, metric units', () => {
  beforeEach(() => useUIStore.setState({ unitSystem: 'metric' }));

  it('shows and accepts mm-based properties', async () => {
    useModelStore.setState({ sections: [W12X26] });
    render(<SectionEditor />);

    expect(screen.getByRole('columnheader', { name: 'A (mm²)' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ix (mm⁴)' })).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /W12x26/ });
    expect(within(row).getByText('4935')).toBeInTheDocument();
    expect(within(row).getByText('84.91e6')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^name$/i), 'Metric');
    await setNumber(/^A \(/, '4935');
    await setNumber(/^J \(/, '124869');
    await userEvent.click(screen.getByRole('button', { name: /add section/i }));

    const added = useModelStore.getState().sections.find((s) => s.name === 'Metric');
    expect(added?.A).toBeCloseTo(4935 / 645.16, 12);
    expect(added?.J).toBeCloseTo(0.3, 5);
  });

  it('takes b, h and cover in mm and rebar fy in MPa', async () => {
    render(<SectionEditor />);
    await userEvent.type(screen.getByLabelText(/^name$/i), 'C300x500');
    await userEvent.click(screen.getByLabelText(/rectangular concrete/i));

    expect(screen.getByLabelText(/^b \(mm\)/)).toHaveValue(406.4);
    await setNumber(/^b \(mm\)/, '300');
    await setNumber(/^h \(mm\)/, '500');
    await userEvent.click(screen.getByLabelText(/column reinforcement/i));
    expect(screen.getByLabelText(/clear cover \(mm\)/i)).toHaveValue(38.1);
    expect(screen.getByLabelText(/rebar fy \(MPa\)/i)).toHaveValue(413.6854376);
    await setNumber(/clear cover \(mm\)/i, '40');
    await setNumber(/rebar fy \(MPa\)/i, '420');
    expect(screen.getByText(/As = \d+ mm²/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /add section/i }));

    const [s] = useModelStore.getState().sections;
    expect(s.b).toBeCloseTo(300 / 25.4, 12);
    expect(s.h).toBeCloseTo(500 / 25.4, 12);
    expect(s.reinforcement?.cover).toBeCloseTo(40 / 25.4, 12);
    expect(s.reinforcement?.fy).toBeCloseTo(420 / 6.894757293168361, 12);
    expect(s.reinforcement?.barsAlongB).toBe(3);
  });

  it('keeps a b draft correct when the unit system changes mid-edit', async () => {
    useUIStore.setState({ unitSystem: 'imperial' });
    render(<SectionEditor />);
    await userEvent.type(screen.getByLabelText(/^name$/i), 'Switch');
    await userEvent.click(screen.getByLabelText(/rectangular concrete/i));
    await setNumber(/^b \(in\)/, '12');

    act(() => useUIStore.setState({ unitSystem: 'metric' }));

    expect(screen.getByLabelText(/^b \(mm\)/)).toHaveValue(304.8);
    await userEvent.click(screen.getByRole('button', { name: /add section/i }));
    expect(useModelStore.getState().sections[0].b).toBeCloseTo(12, 12);
  });
});
