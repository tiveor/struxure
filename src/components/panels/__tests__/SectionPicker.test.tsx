// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SectionPicker } from '../SectionPicker';
import { useModelStore } from '../../../store/model-store';
import { useUIStore } from '../../../store/ui-store';

beforeEach(() => {
  useUIStore.setState(useUIStore.getInitialState(), true);
  useModelStore.getState().clearModel();
  useModelStore.setState({ sections: [] });
});

function w12x26Row() {
  return screen.getByRole('row', { name: /^W12x26\b/ });
}

describe('SectionPicker', () => {
  it('offers only the shape families the library contains', () => {
    render(<SectionPicker onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'W' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'HSS' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pipe' })).toBeNull();
  });

  it('labels imperial columns and keeps the values as published', () => {
    useUIStore.setState({ unitSystem: 'imperial' });
    render(<SectionPicker onClose={() => {}} />);

    for (const name of ['d (in)', 'bf (in)', 'A (in²)', 'Ix (in⁴)', 'wt (lb/ft)']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
    }
    const cells = within(w12x26Row()).getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toEqual(['W12x26', '12.2', '6.5', '7.7', '204', '26']);
  });

  it('converts the values to mm and kg/m in metric', () => {
    useUIStore.setState({ unitSystem: 'metric' });
    render(<SectionPicker onClose={() => {}} />);

    for (const name of ['d (mm)', 'bf (mm)', 'A (mm²)', 'Ix (mm⁴)', 'wt (kg/m)']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
    }
    const cells = within(w12x26Row()).getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toEqual(['W12x26', '310', '165', '4935', '84.91e6', '38.7']);
  });
});
