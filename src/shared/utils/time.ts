// Converts ms to "MMM:SS", where M is minute digit
// Example: 96500 ms (96.5 minutes) => "96:30"
export function formatMsToMMSS(ms: number): string {
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

// "H:MM:SS", or "M:SS" under an hour
export const formatCountdown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
};

// "45m", "30s" or "1m 30s"
export const formatDuration = (ms: number) => {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
};

export const formatClockTime = (epochMs: number) => {
  return new Date(epochMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

// "HH:MM" to minutes since midnight
export function convertTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// "HH:MM" strings compare correctly as text. shortcut: overnight workdays aren't supported yet, so the end must come after the start
export const isValidWorkdayHours = (start: string, end: string) => start !== "" && start < end;
