import { test, expect, vi } from 'vitest';

vi.mock('@assets/sounds/warning-2.mp3', () => ({ default: '/mocked/warning-2.mp3' }));

const played: { src: string; volume: number }[] = [];
vi.stubGlobal('Audio', class {
  volume = 1;
  constructor(public src: string) {}
  play() { played.push({ src: this.src, volume: this.volume }); }
});

import { playWarningSound } from './sound';

test('the warning plays at the volume it is given, kept within what audio allows', () => {
  playWarningSound(0.3);
  playWarningSound(50);
  playWarningSound(NaN);
  expect(played.map(({ volume }) => volume)).toEqual([0.3, 1, 0]);
  expect(played[0].src).toBe('/mocked/warning-2.mp3');
});
