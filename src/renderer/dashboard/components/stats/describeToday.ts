import { DayScore, MAX_LEVEL } from "@main/stats/checkpoints";
import { CHECKPOINTS } from "@shared/constants";
import { formatClockTime, formatCountdown } from "@shared/utils/time";

const { NAMES } = CHECKPOINTS;

// What the today panel says: the big countdown, the small words beside it, and the line under the level
export interface TodayWords {
  countdown: string | null; // "1:59:30", or nothing when there's no clock to show
  unit: string | null;      // "until Glow", "left", or the whole message when there's no countdown
  line: string;
  stopped: boolean;         // The line is drawn as a warning
}

export const describeToday = (score: DayScore, now: number): TodayWords => {
  if (now < score.workStart) {
    return {
      countdown: null,
      unit: `Workday starts at ${formatClockTime(score.workStart)}`,
      line: `Each unbroken quarter of the day climbs a checkpoint: ${NAMES.slice(1).join(", ")}`,
      stopped: false,
    };
  }
  if (!score.inProgress) {
    return { countdown: null, unit: null, line: "Where the workday ended", stopped: false };
  }
  if (score.losing) {
    // No next loss once at Dim, or when it would land after the workday
    const nextLoss = score.nextLossAt ? ` · drop to ${NAMES[score.level - 1]} in ${formatCountdown(score.nextLossAt - now)}` : "";
    return { countdown: null, unit: "Resume to climb again", line: `Stopped${nextLoss}`, stopped: true };
  }
  if (score.runStart === null) {
    return { countdown: null, unit: "Resume to climb again", line: "Stopped", stopped: false };
  }

  const line = `Unbroken for ${formatCountdown(now - score.runStart)} · ${NAMES[score.bestPossible]} still reachable`;
  if (score.level === MAX_LEVEL) {
    return { countdown: formatCountdown(score.workEnd - now), unit: "left", line: "The whole day, unbroken", stopped: false };
  }
  if (score.nextCheckpointAt) {
    return { countdown: formatCountdown(score.nextCheckpointAt - now), unit: `until ${NAMES[score.level + 1]}`, line, stopped: false };
  }
  return { countdown: formatCountdown(score.workEnd - now), unit: `left · hold ${NAMES[score.level]}`, line, stopped: false };
};
