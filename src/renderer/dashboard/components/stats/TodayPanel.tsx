import { DayScore } from "@main/stats/checkpoints";
import { CHECKPOINTS } from "@shared/constants";
import CheckpointOrb from "./CheckpointOrb";
import DayBar from "./DayBar";
import { describeToday } from "./describeToday";

const { NAMES } = CHECKPOINTS;

export default function TodayPanel({ score }: { score: DayScore | null }) {
  if (!score) {
    return (
      <div data-testid="today-panel" className="bg-white border border-slate-200 rounded-xl p-3 text-slate-500">
        No workday today
      </div>
    );
  }

  // Re-renders every second with the timer's updates, so the countdown ticks
  const { countdown, unit, line, stopped } = describeToday(score, Date.now());

  return (
    <div data-testid="today-panel" className="bg-white border border-slate-200 rounded-xl px-3.5 py-3">
      <div data-testid="today-checkpoint" className="flex items-center gap-3.5">
        <CheckpointOrb level={score.level} />
        <div className="grow min-w-0">
          <div data-testid="today-level" className="text-xl font-extrabold">{NAMES[score.level]}</div>
          <div className={`text-xs ${stopped ? "text-red-600 font-semibold" : "text-slate-500"}`}>{line}</div>
        </div>
        <div data-testid="today-countdown" className="text-right text-2xl font-extrabold tabular-nums">
          {countdown}{countdown && unit && " "}{unit && <small className="text-sm font-semibold text-slate-500">{unit}</small>}
        </div>
      </div>
      <DayBar score={score} />
    </div>
  );
}
