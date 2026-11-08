import warningSoundUrl from '@assets/sounds/warning-2.mp3';

export const playWarningSound = (volume: number) => {
  const audio = new Audio(warningSoundUrl);
  audio.volume = Math.min(1, Math.max(0, volume || 0)); // Outside 0 to 1 the setter throws, and a hand-edited file could put it there
  audio.play();
};
