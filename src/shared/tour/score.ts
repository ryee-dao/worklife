import type { DayScore } from "@main/stats/checkpoints";
import { getTodayDateAsString } from "@shared/utils/date";
import type { TourBeat } from "./beats";

const HOUR_MS = 60 * 60 * 1000;
const STOPPED_FOR_MS = 60 * 1000;
const DECAY_MS = 15 * 60 * 1000;

// The day the Stats tab shows during the tour: four hours into an eight-hour day, two checkpoints up, and then just stopped,
// so a stop's cost is seen rather than read. Built by hand, since the real scorer wants a workday that contains now;
// its test checks the scorer agrees. The stop lands a minute after the second checkpoint, so it costs that one
export const tourScore = (beat: TourBeat, now: number): DayScore | null => {
  if (!beat.score) return null;
  const workStart = now - 4 * HOUR_MS - STOPPED_FOR_MS;
  const stopped = beat.score === "STOPPED";
  const stoppedAt = now - STOPPED_FOR_MS;
  return {
    localDate: getTodayDateAsString(new Date(now)),
    level: stopped ? 1 : 2,
    inProgress: true,
    climbing: !stopped,
    runStart: stopped ? null : workStart,
    nextCheckpointAt: stopped ? null : workStart + 6 * HOUR_MS,
    nextLossAt: stopped ? stoppedAt + DECAY_MS : null,
    losing: stopped,
    bestPossible: stopped ? 2 : 4, // Resuming now climbs one more before the day ends
    pieces: stopped
      ? [{ start: workStart, end: stoppedAt, activity: "WORKING" }, { start: stoppedAt, end: now, activity: "STOPPED" }]
      : [{ start: workStart, end: now, activity: "WORKING" }],
    workStart,
    workEnd: workStart + 8 * HOUR_MS,
    powerupsUsed: 0,
    lunchTaken: false,
  };
};
