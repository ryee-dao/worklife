import { app } from "electron";
import path from "path";

export const IS_DEV = (!app.isPackaged && !!process.env.VITE_DEV_SERVER_URL); // Returns false if packaged into an executible
export { IS_TEST } from "./testEnv";
export const PRELOAD_PATH = path.join(__dirname, "../preload.js");
export const RENDERER_PATH = path.join(__dirname, "../renderer");
// Lives here because env.ts sits at the bundle's depth: src/assets under vitest, dist/assets once bundled
export const ASSETS_DIR = path.join(__dirname, "../assets");