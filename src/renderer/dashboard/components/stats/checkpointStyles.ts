import { Activity } from "@main/stats/checkpoints";
import { CHECKPOINTS } from "@shared/constants";

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

// How far along a square's diagonal a corner-to-corner fill must reach to cover a share of its area: the filled part is a
// triangle up to the middle (area 2d²), and the unfilled part is one past it
export const diagonalFor = (share: number) => (share <= 0.5 ? Math.sqrt(share / 2) : 1 - Math.sqrt((1 - share) / 2));

// Fills a day's square diagonally from its bottom-left corner, covering a quarter of it per checkpoint, so Radiant fills it all
export const getLevelFill = (level: number) => {
  const color = LEVEL_COLORS[level];
  const diagonalPercent = diagonalFor(level / maxLevel) * 100;
  return {
    background: `linear-gradient(to top right, ${color} ${diagonalPercent}%, #fff ${diagonalPercent}%)`,
    borderColor: level ? color : "#e2e8f0",
  };
};

// "H:MM:SS", or "M:SS" under an hour
export const formatCountdown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
};
