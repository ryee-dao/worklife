import { FILENAMES } from "@shared/constants";
import { getUserDataFromFile, writeToUserDataFile } from "@shared/utils/files";
import { fromSaved, isBetween } from "@shared/utils/configs";

export interface SoundConfigs {
  volume: number; // 0 to 1
}

const defaultSoundConfigs: SoundConfigs = { volume: 0.5 };

// Read when a sound plays, so a change applies right away
let soundConfigs: SoundConfigs;

export const loadSoundConfigs = () => {
  const soundConfigsData = getUserDataFromFile<SoundConfigs>(FILENAMES.SOUND.CONFIGS);
  soundConfigs = fromSaved(defaultSoundConfigs, soundConfigsData?.fileContent, { volume: isBetween(0, 1) });
  writeToUserDataFile(FILENAMES.SOUND.CONFIGS, soundConfigs);
};

export const getSoundConfigs = () => soundConfigs;

export const setSoundConfigs = (newSoundConfigs: SoundConfigs) => {
  soundConfigs = newSoundConfigs;
  return writeToUserDataFile(FILENAMES.SOUND.CONFIGS, soundConfigs);
};
