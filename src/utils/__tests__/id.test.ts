import { describe, it, expect } from 'vitest';
import { newId } from '../id';

describe('newId', () => {
  it('should produce a prefixed id matching mat-<8 hex chars>', () => {
    const id = newId('mat');
    expect(id).toMatch(/^mat-[0-9a-f]{8}$/);
  });

  it('should produce an unprefixed id matching <8 hex chars>', () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('should produce 1000 distinct values across successive calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId('sec')));
    expect(ids.size).toBe(1000);
  });
});
