import { describe, test, expect } from 'vitest';
import { diagonalFor } from './checkpointStyles';

describe('diagonalFor', () => {
  test('covers the share of the square asked for, so each checkpoint adds a quarter', () => {
    // A corner fill reaching d along the diagonal covers 2d² of the square, and past the middle leaves 2(1-d)² unfilled
    const area = (d: number) => (d <= 0.5 ? 2 * d * d : 1 - 2 * (1 - d) * (1 - d));
    for (const share of [0, 0.25, 0.5, 0.75, 1]) expect(area(diagonalFor(share))).toBeCloseTo(share);
    expect(diagonalFor(0.25)).toBeLessThan(0.5);
    expect(diagonalFor(0.75)).toBeGreaterThan(0.5);
  });
});
