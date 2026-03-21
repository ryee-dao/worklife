import { rmSync, existsSync, readdirSync } from "fs";
import path from "path";

const PW_TMP_DIR = path.join(__dirname, "../../.tmp/pw");

export default function globalSetup() {
  if (!existsSync(PW_TMP_DIR)) return;

  const dirs = readdirSync(PW_TMP_DIR).filter((dir) =>
    dir.startsWith("worklife-test-")
  );

  for (const dir of dirs) {
    rmSync(path.join(PW_TMP_DIR, dir), { recursive: true, force: true });
  }
}