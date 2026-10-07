// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SectionPicker } from '../SectionPicker';
import { useModelStore } from '../../../store/model-store';
import { useUIStore } from '../../../store/ui-store';
import { EURO_SECTIONS, euroToSection } from '../../../data/euro-sections';

beforeEach(() => {
  useUIStore.setState(useUIStore.getInitialState(), true);
  useModelStore.getState().clearModel();
  useModelStore.setState({ sections: [] });
});

function rowNamed(name: string) {
  return screen.getByRole('row', { name: new RegExp(`^${name}\\b`) });
}

function cells(name: string) {
  return within(rowNamed(name)).getAllByRole('cell').map((c) => c.textContent);
}

describe('SectionPicker', () => {
  it('offers only the shape families the library contains', () => {
    useUIStore.setState({ unitSystem: 'imperial' });
    render(<SectionPicker onClose={() => {}} />);
    expect(screen.getByRole('tab', { name: 'AISC' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'W' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'HSS' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pipe' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'IPE' })).toBeNull();
  });

  it('labels imperial columns and keeps the values as published', () => {
    useUIStore.setState({ unitSystem: 'imperial' });
    render(<SectionPicker onClose={() => {}} />);

    for (const name of ['d (in)', 'bf (in)', 'A (in²)', 'Ix (in⁴)', 'wt (lb/ft)']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
    }
    expect(cells('W12x26')).toEqual(['W12x26', '12.2', '6.5', '7.7', '204', '26']);
  });

  it('converts the values to mm and kg/m in metric', async () => {
    useUIStore.setState({ unitSystem: 'metric' });
    render(<SectionPicker onClose={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: 'AISC' }));

    for (const name of ['d (mm)', 'bf (mm)', 'A (mm²)', 'Ix (mm⁴)', 'wt (kg/m)']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
    }
    expect(cells('W12x26')).toEqual(['W12x26', '310', '165', '4935', '84.91e6', '38.7']);
  });
});

describe('SectionPicker, EN library', () => {
  it('opens on the EN library in metric and shows published values', () => {
    useUIStore.setState({ unitSystem: 'metric' });
    render(<SectionPicker onClose={() => {}} />);
    expect(screen.getByRole('tab', { name: 'EN' })).toHaveAttribute('aria-selected', 'true');
    for (const f of ['IPE', 'HEA', 'HEB']) {
      expect(screen.getByRole('button', { name: f })).toBeInTheDocument();
    }
    expect(screen.getByText('56 sections')).toBeInTheDocument();
    expect(cells('IPE300')).toEqual(['IPE300', '300', '150', '5381', '83.56e6', '42.2']);
    expect(cells('HEB200')).toEqual(['HEB200', '200', '200', '7808', '56.96e6', '61.3']);
  });

  it('shows EN sections in imperial units', async () => {
    useUIStore.setState({ unitSystem: 'imperial' });
    render(<SectionPicker onClose={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: 'EN' }));
    expect(cells('IPE300')).toEqual(['IPE300', '11.8', '5.9', '8.3', '201', '28.4']);
  });

  it('filters by family and searches ignoring spaces', async () => {
    useUIStore.setState({ unitSystem: 'metric' });
    render(<SectionPicker onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'HEA' }));
    expect(screen.getByText('19 sections')).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /^IPE300\b/ })).toBeNull();

    await userEvent.type(screen.getByLabelText(/search sections/i), 'hea 2');
    expect(screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent))
      .toEqual(['HEA200', 'HEA220', 'HEA240', 'HEA260', 'HEA280']);
  });

  it('adds an EN section to the model like an AISC one', async () => {
    useUIStore.setState({ unitSystem: 'metric' });
    let closed = false;
    render(<SectionPicker onClose={() => { closed = true; }} />);
    await userEvent.click(rowNamed('IPE300'));

    const [s] = useModelStore.getState().sections;
    expect(s).toEqual(euroToSection(EURO_SECTIONS.find((x) => x.name === 'IPE300')!));
    expect(s.shape).toBe('I');
    expect(closed).toBe(true);
  });
});
