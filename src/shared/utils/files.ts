import path from "path";
import fs from "fs";
import { app } from "electron";

export function getUserDataFromFile<T>(fileName: string) {
  const filePath = path.join(app.getPath("userData"), fileName);
  let fileContent: T | undefined = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, "utf-8"))
    : undefined;
  return { filePath, fileContent };
}

export function writeToUserDataFile(fileName: string, fileContent: unknown) {
  // Write new state to file
  fs.writeFileSync(
    path.join(app.getPath("userData"), fileName),
    JSON.stringify(fileContent)
  );
  console.log(`Wrote ${JSON.stringify(fileContent)} to file: ${fileName}`);
}
