// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultsPanel } from '../ResultsPanel';
import { ColorLegend } from '../../viewport/Viewport3D';
import { useResultsStore } from '../../../store/results-store';
import type { DesignResult } from '../../../store/results-store';
import type { AnalysisResults } from '../../../core/types';

const EMPTY_RESULTS: AnalysisResults = {
  displacements: [],
  reactions: new Map(),
  elementForces: new Map(),
  nodeDisplacements: new Map(),
};

const REASON = 'Assumed steel, screening only.';

const column: DesignResult = {
  elementId: 'C1', material: 'concrete', ratio: 0.5, status: 'pass',
  details: { flexureRatio: 0.5, shearRatio: 0, AvRequired: 0, rhoAssumed: 0.01 },
  indicative: { reason: REASON },
};

const beam: DesignResult = {
  elementId: 'B1', material: 'concrete', ratio: 0.4, status: 'pass',
  details: { flexureRatio: 0.4, shearRatio: 0.2, AsRequired: 1.2, AvRequired: 0 },
};

function seed(designResults: DesignResult[]) {
  useResultsStore.getState().clearResults();
  useResultsStore.getState().setAnalysisResults(EMPTY_RESULTS);
  useResultsStore.getState().setDesignResults(designResults);
}

describe('ResultsPanel, indicative design results', () => {
  beforeEach(() => useResultsStore.getState().clearResults());

  it('marks an indicative ratio and explains it in a footnote', () => {
    seed([column, beam]);
    render(<ResultsPanel />);

    const marks = screen.getAllByLabelText('indicative');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveAttribute('title', `Indicative: ${REASON}`);
    expect(marks[0].closest('tr')).toHaveTextContent('C1');
    expect(screen.getByText(new RegExp(REASON.replace('.', '\\.')))).toBeInTheDocument();
  });

  it('shows no marker or footnote when nothing is indicative', () => {
    seed([beam]);
    render(<ResultsPanel />);

    expect(screen.queryByLabelText('indicative')).toBeNull();
    expect(screen.queryByText(/Indicative:/)).toBeNull();
  });
});

describe('ColorLegend, indicative design results', () => {
  beforeEach(() => useResultsStore.getState().clearResults());

  it('notes indicative ratios on the D/C heatmap', () => {
    seed([column, beam]);
    render(<ColorLegend scheme="jet" variable="dc_ratio" />);

    const note = screen.getByText('Indicative');
    expect(note.closest('p')).toHaveAttribute('title', expect.stringContaining(REASON));
  });

  it('omits the note for other heatmap variables', () => {
    seed([column]);
    render(<ColorLegend scheme="jet" variable="displacement" />);

    expect(screen.queryByText('Indicative')).toBeNull();
  });

  it('omits the note when no result is indicative', () => {
    seed([beam]);
    render(<ColorLegend scheme="jet" variable="dc_ratio" />);

    expect(screen.queryByText('Indicative')).toBeNull();
  });
});
