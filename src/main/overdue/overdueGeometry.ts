import { Size, Rectangle } from "electron";
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

export const clampRectToWorkArea = (rect: Rectangle, workArea: Rectangle): Rectangle => {
  // Largest x/y that still keeps the window fully inside (right/bottom edge on the boundary)
  const maxX = workArea.x + workArea.width - rect.width;
  const maxY = workArea.y + workArea.height - rect.height;

  // Clamp position between the top-left corner and those maxes.
  // If the window is bigger than the work area, maxX < workArea.x, and this pins to top-left.
  const x = Math.max(workArea.x, Math.min(rect.x, maxX));
  const y = Math.max(workArea.y, Math.min(rect.y, maxY));

  return { x, y, width: rect.width, height: rect.height };
};