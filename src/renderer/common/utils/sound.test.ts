import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@assets/sounds/warning-1.mp3', () => ({
  default: '/mocked/warning-1.mp3',
}));

const mockPlay = vi.fn();
let lastAudioSrc: string | undefined;

vi.stubGlobal('Audio', class {
  src: string;
  constructor(src?: string) {
    this.src = src || '';
    lastAudioSrc = src;
  }
  play = mockPlay;
});

beforeEach(() => {
  mockPlay.mockClear();
  lastAudioSrc = undefined;
});

import { playWarningSound } from './sound';

describe('playWarningSound', () => {
  test('plays audio with default sound file', () => {
    playWarningSound();

    expect(lastAudioSrc).toBe('/mocked/warning-1.mp3');
    expect(mockPlay).toHaveBeenCalledOnce();
  });

  test('plays audio with custom sound file when provided', () => {
    playWarningSound('/sounds/custom-alert.mp3');

    expect(lastAudioSrc).toBe('/sounds/custom-alert.mp3');
    expect(mockPlay).toHaveBeenCalledOnce();
  });
});