import { FILENAMES } from "@shared/constants";
import { getUserDataFromFile, writeToUserDataFile } from "@shared/utils/files";

interface TourState {
  seen: boolean;
}

// The first-run tour shows once per install, until it's replayed from the settings
export const isTourSeen = () => {
  return getUserDataFromFile<TourState>(FILENAMES.TOUR.STATE).fileContent?.seen === true;
};

export const markTourSeen = () => {
  writeToUserDataFile(FILENAMES.TOUR.STATE, { seen: true } satisfies TourState);
};
