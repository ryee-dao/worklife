import { Activity, DayScore } from "../../../../main/stats/checkpoints";
import { ACTIVITY_COLORS, ACTIVITY_NAMES, formatClockTime } from "./checkpointStyles";

// The workday from start to end, colored by what the app was doing
export default function DayBar({ score }: { score: DayScore }) {
  const workdayMs = score.workEnd - score.workStart;
  const toPercent = (ms: number) => `${(ms / workdayMs) * 100}%`;
  const now = Date.now();
  const showNow = now > score.workStart && now < score.workEnd;

  return (
    <div>
      <div data-testid="day-bar" className={`relative h-3.5 mt-2 rounded-full bg-slate-100 overflow-hidden ${score.losing ? "animate-flash" : ""}`}>
        {score.pieces.map((piece) => (
          <span
            key={piece.start}
            className="absolute inset-y-0"
            style={{ left: toPercent(piece.start - score.workStart), width: toPercent(piece.end - piece.start), background: ACTIVITY_COLORS[piece.activity] }}
          />
        ))}
        {showNow && <span className="absolute inset-y-0 w-0.5 bg-slate-900" style={{ left: toPercent(now - score.workStart) }} />}
      </div>
      <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-slate-500">
        {(Object.keys(ACTIVITY_COLORS) as Activity[]).map((activity) => (
          <span key={activity}>
            <i className="inline-block size-2.5 mr-1 rounded-sm align-[-1px]" style={{ background: ACTIVITY_COLORS[activity] }} />
            {ACTIVITY_NAMES[activity]}
          </span>
        ))}
        <span className="ml-auto">{formatClockTime(score.workStart)} → {formatClockTime(score.workEnd)}</span>
      </div>
    </div>
  );
}
