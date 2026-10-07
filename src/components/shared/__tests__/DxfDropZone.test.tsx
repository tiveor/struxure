// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DxfDropZone } from '../DxfDropZone';
import { useUIStore } from '../../../store/ui-store';
import { importDxf } from '../../../utils/dxf-import';
import type { DxfImportResult } from '../../../utils/dxf-import';

vi.mock('../../../utils/dxf-import', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/dxf-import')>();
  return { ...actual, importDxf: vi.fn() };
});

const RESULT: DxfImportResult = {
  nodes: [],
  elements: [],
  warnings: [],
  layers: ['0'],
  stats: { linesFound: 1, nodesCreated: 2, elementsCreated: 1, duplicatesMerged: 0 },
};

async function dropDxf() {
  const file = { name: 'frame.dxf', text: async () => 'DXF CONTENT' };
  fireEvent.drop(screen.getByTestId('drop-target').parentElement as HTMLElement, {
    dataTransfer: { files: [file], items: [] },
  });
  return screen.findByRole('heading', { name: 'Import DXF' });
}

beforeEach(() => {
  useUIStore.setState(useUIStore.getInitialState(), true);
  vi.mocked(importDxf).mockReset().mockReturnValue(RESULT);
});

describe('DxfDropZone drawing units', () => {
  it('assumes inches in imperial mode', async () => {
    useUIStore.setState({ unitSystem: 'imperial' });
    render(<DxfDropZone><div data-testid="drop-target" /></DxfDropZone>);

    await dropDxf();
    expect(importDxf).toHaveBeenCalledWith('DXF CONTENT', { units: 'inches' });
    expect(screen.getByLabelText('Units:')).toHaveValue('inches');
  });

  it('assumes millimetres in metric mode', async () => {
    useUIStore.setState({ unitSystem: 'metric' });
    render(<DxfDropZone><div data-testid="drop-target" /></DxfDropZone>);

    await dropDxf();
    expect(importDxf).toHaveBeenCalledWith('DXF CONTENT', { units: 'mm' });
    expect(screen.getByLabelText('Units:')).toHaveValue('mm');
  });

  it('re-imports the open file when the unit is changed', async () => {
    useUIStore.setState({ unitSystem: 'metric' });
    render(<DxfDropZone><div data-testid="drop-target" /></DxfDropZone>);
    await dropDxf();

    await userEvent.selectOptions(screen.getByLabelText('Units:'), 'm');
    expect(importDxf).toHaveBeenLastCalledWith('DXF CONTENT', { units: 'm' });
  });
});
