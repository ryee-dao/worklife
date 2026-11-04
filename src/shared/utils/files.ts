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

export function writeToUserDataFile(fileName: string, fileContent: unknown) {
  const filePath = path.join(app.getPath("userData"), fileName);
  // Write then rename, so a crash mid-write never leaves a half-written file
  fs.writeFileSync(`${filePath}.tmp`, JSON.stringify(fileContent));
  fs.renameSync(`${filePath}.tmp`, filePath);
}

export function readUserDataTextFile(fileName: string) {
  const filePath = path.join(app.getPath("userData"), fileName);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
}

export function appendToUserDataFile(fileName: string, content: string) {
  fs.appendFileSync(path.join(app.getPath("userData"), fileName), content);
}
