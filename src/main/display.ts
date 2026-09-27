import { screen } from "electron";

export let workArea: Electron.Rectangle | undefined;

export function setWorkArea() {
  workArea = screen.getPrimaryDisplay().workArea;
}
export const getWorkArea = () => workArea;

export function refreshWorkAreaForBounds(bounds: Electron.Rectangle) {
  workArea = screen.getDisplayMatching(bounds).workArea;
}