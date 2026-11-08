import { Activity, MAX_LEVEL } from "@main/stats/checkpoints";

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
  const diagonalPercent = diagonalFor(level / MAX_LEVEL) * 100;
  return {
    background: `linear-gradient(to top right, ${color} ${diagonalPercent}%, #fff ${diagonalPercent}%)`,
    borderColor: level ? color : "#e2e8f0",
  };
};
