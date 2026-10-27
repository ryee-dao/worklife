import { Activity } from "../../../../main/stats/checkpoints";
import { CHECKPOINTS } from "../../../../shared/constants";

const maxLevel = CHECKPOINTS.NAMES.length - 1;

// Sunrise shades, one per checkpoint, from Dim's white up to Radiant's orange
export const LEVEL_COLORS = ["#ffffff", "#f3e8d6", "#e9cf9c", "#f4b942", "#f08c1a"];

export const ACTIVITY_COLORS: Record<Activity, string> = {
  WORKING: "#f59e0b",
  LUNCH: "#3b82f6",
  STOPPED: "#ef4444",
  CLOSED: "#cbd5e1",
};

export const ACTIVITY_NAMES: Record<Activity, string> = {
  WORKING: "working",
  LUNCH: "lunch",
  STOPPED: "stopped",
  CLOSED: "closed",
};

// SHARE fills a day's square up to its checkpoint, so Glimmer fills a quarter. WHOLE colors the whole square
export type FillMode = "SHARE" | "WHOLE";

export const getLevelFill = (level: number, fillMode: FillMode) => {
  const color = LEVEL_COLORS[level];
  const sharePercent = (level / maxLevel) * 100;
  return {
    background: fillMode === "SHARE" ? `linear-gradient(to top, ${color} ${sharePercent}%, #fff ${sharePercent}%)` : color,
    borderColor: level ? color : "#e2e8f0",
  };
};

export const formatClockTime = (epochMs: number) => {
  return new Date(epochMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

// "H:MM:SS", or "M:SS" under an hour
export const formatCountdown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
};
