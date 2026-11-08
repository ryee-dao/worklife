import { describe, test, expect } from 'vitest';
import { fromSaved, isBetween, isCount, isPositiveMs } from './configs';

describe('a saved config', () => {
  const defaults = { ms: 1000, count: 3, ratio: 0.5 };
  const valid = { ms: isPositiveMs, count: isCount, ratio: isBetween(0, 1) };

  test('keeps the fields that are the right shape, and falls back on the rest', () => {
    expect(fromSaved(defaults, { ms: 2000, count: 1.5, ratio: 5 }, valid)).toEqual({ ms: 2000, count: 3, ratio: 0.5 });
    expect(fromSaved(defaults, { ms: '45' as unknown as number, count: -1 }, valid)).toEqual(defaults);
    expect(fromSaved(defaults, undefined, valid)).toEqual(defaults);
  });

  test('ignores fields the config no longer has', () => {
    expect(fromSaved(defaults, { ms: 2000, old: true } as object, valid)).toEqual({ ...defaults, ms: 2000 });
  });
});
