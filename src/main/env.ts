import { app } from "electron";
import path from "path";

export const IS_DEV = (!app.isPackaged && !!process.env.VITE_DEV_SERVER_URL); // Returns false if packaged into an executible
export const IS_TEST = !!process.env.PLAYWRIGHT_TEST;
export const PRELOAD_PATH = path.join(__dirname, "../preload.js");
export const RENDERER_PATH = path.join(__dirname, "../renderer");