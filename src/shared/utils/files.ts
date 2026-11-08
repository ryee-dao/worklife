import path from "path";
import fs from "fs";
import { app } from "electron";

export function getUserDataFromFile<T>(fileName: string) {
  const filePath = path.join(app.getPath("userData"), fileName);
  let fileContent: T | undefined;
  if (fs.existsSync(filePath)) {
    try {
      fileContent = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      // A broken file falls back to defaults instead of stopping the app from starting
      console.warn(`Ignoring unreadable user data file: ${fileName}`);
    }
  }
  return { filePath, fileContent };
}

// A write that fails (disk full, a file held open on Windows) is logged, not thrown: writes come from inside the timer's
// interval, where a throw would take the app down while the state in memory was fine. The next write tries again.
// Whether it worked, for the callers that can tell the user
const attempt = (fileName: string, write: () => void) => {
  try {
    write();
    return true;
  } catch (error) {
    console.warn(`Could not save ${fileName}:`, error);
    return false;
  }
};

export function writeToUserDataFile(fileName: string, fileContent: unknown) {
  const filePath = path.join(app.getPath("userData"), fileName);
  // Write then rename, so a crash mid-write never leaves a half-written file
  return attempt(fileName, () => {
    fs.writeFileSync(`${filePath}.tmp`, JSON.stringify(fileContent));
    fs.renameSync(`${filePath}.tmp`, filePath);
  });
}

export function readUserDataTextFile(fileName: string) {
  const filePath = path.join(app.getPath("userData"), fileName);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
}

export function appendToUserDataFile(fileName: string, content: string) {
  attempt(fileName, () => fs.appendFileSync(path.join(app.getPath("userData"), fileName), content));
}
