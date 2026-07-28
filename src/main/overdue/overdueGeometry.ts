import { Size } from "electron";
import { OverdueConfigs } from "./overdueConfigs";

export interface OverdueLevelObject {
  levelIdx: number,
  levelStartMs: number,
  levelWindowRatio: number
}


export const convertOverdueTimeToOverdueLevelObject = (
  overdueTimeMs: number,
  overdueLevelsArray: OverdueLevelObject[],
): OverdueLevelObject => {
  let currentLevel = overdueLevelsArray[0];

  for (const level of overdueLevelsArray) {
    if (overdueTimeMs >= level.levelStartMs) {
      currentLevel = level;
    }
  }

  return currentLevel;
};

export const convertOverdueLevelObjectToScreenSize = (
  screenSize: Size,
  overdueLevelObject: OverdueLevelObject
): Size => {
  // Scale it by sqrt since we are converting ratio into area
  // Example: windowRatio = .8 = we want to return the height/width that covers 80% of the screen
  const scale = Math.sqrt(overdueLevelObject.levelWindowRatio);
  return {
    width: screenSize.width * scale,
    height: screenSize.height * scale,
  };
};

export const createOverdueLevelsArray = (overdueConfigs: OverdueConfigs) => {
  const { levelThresholdMs, windowLevelCap: numberOfLevels, windowRatioCap } = overdueConfigs;

  const overdueLevelsArray: OverdueLevelObject[] = [];

  for (let level = 0; level < numberOfLevels; level++) {
    overdueLevelsArray.push({
      levelIdx: level,
      levelStartMs: level * levelThresholdMs,
      levelWindowRatio: Number((((level + 1) / numberOfLevels) * windowRatioCap).toFixed(2)),
    });
  }

  return overdueLevelsArray;
};