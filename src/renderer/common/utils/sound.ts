import warningSoundUrl from '@assets/sounds/warning-2.mp3';

export const playWarningSound = (soundFile: string = warningSoundUrl) => {
  const audio = new Audio(soundFile);
  audio.play();
};