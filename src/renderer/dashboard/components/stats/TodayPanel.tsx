import { ReactNode } from "react";
import { DayScore } from "../../../../main/stats/checkpoints";
import { CHECKPOINTS } from "../../../../shared/constants";
import CheckpointOrb from "./CheckpointOrb";
import DayBar from "./DayBar";
import { formatClockTime, formatCountdown } from "./checkpointStyles";

const { NAMES } = CHECKPOINTS;
const maxLevel = NAMES.length - 1;

// The countdown to the next checkpoint (or the next loss) and a line explaining it
const describeToday = (score: DayScore, now: number): { countdown: ReactNode; line: ReactNode } => {
  const unit = (text: string) => <small className="text-sm font-semibold text-slate-500">{text}</small>;

  if (now < score.workStart) {
    return {
      countdown: unit(`Workday starts at ${formatClockTime(score.workStart)}`),
      line: `Each unbroken quarter of the day climbs a checkpoint: ${NAMES.slice(1).join(", ")}`,
    };
  }
  if (!score.inProgress) {
    return { countdown: null, line: "Where the workday ended" };
  }
  if (score.losing) {
    const decayMs = (score.workEnd - score.workStart) * CHECKPOINTS.DECAY_RATIO;
    return {
      countdown: score.nextLossAt
        ? <>{formatCountdown(score.nextLossAt - now)} {unit(`until you drop to ${NAMES[score.level - 1]}`)}</>
        : unit("Resume to climb again"),
      line: <span className="text-red-600 font-semibold">Stopped · losing a checkpoint every {formatCountdown(decayMs)}</span>,
    };
  }
  if (score.runStart === null) {
    return { countdown: unit("Resume to climb again"), line: "Stopped" };
  }

  const line = `Unbroken for ${formatCountdown(now - score.runStart)} · ${NAMES[score.bestPossible]} still reachable`;
  if (score.level === maxLevel) {
    return { countdown: <>{formatCountdown(score.workEnd - now)} {unit("left")}</>, line: "The whole day, unbroken" };
  }
  if (score.nextCheckpointAt) {
    return { countdown: <>{formatCountdown(score.nextCheckpointAt - now)} {unit(`until ${NAMES[score.level + 1]}`)}</>, line };
  }
  return { countdown: <>{formatCountdown(score.workEnd - now)} {unit(`left · hold ${NAMES[score.level]}`)}</>, line };
};

export default function TodayPanel({ score }: { score: DayScore | null }) {
  if (!score) {
    return (
      <div data-testid="today-panel" className="bg-white border border-slate-200 rounded-xl p-3 text-slate-500">
        No workday today
      </div>
    );
  }

  // Re-renders every second with the timer's updates, so the countdown ticks
  const { countdown, line } = describeToday(score, Date.now());

  return (
    <div data-testid="today-panel" className="bg-white border border-slate-200 rounded-xl px-3.5 py-3">
      <div className="flex items-center gap-3.5">
        <CheckpointOrb level={score.level} />
        <div className="grow min-w-0">
          <div data-testid="today-level" className="text-xl font-extrabold">{NAMES[score.level]}</div>
          <div className="text-xs text-slate-500">{line}</div>
        </div>
        <div data-testid="today-countdown" className="text-right text-2xl font-extrabold tabular-nums">{countdown}</div>
      </div>
      <DayBar score={score} />
    </div>
  );
}
