// Converts ms to "MMM:SS", where M is minute digit
// Example: 96500 ms (96.5 minutes) => "96:30"
export function formatMsToMMSS(ms?: number): string {
  if (!ms && typeof(ms) !== "number") {
    return "";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function convertMsToMinutes(ms: number): number {
  return ms / 60 / 1000;
}

export function convertSecondsToMs(seconds: number): number {
  return seconds * 1000;
}

export function convertMsToSeconds(ms: number): number {
  return ms / 1000;
}

export function convertMinutesToMs(minutes: number): number {
  return minutes * 60 * 1000
}