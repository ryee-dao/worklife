import { DayScore } from "../../../../main/stats/checkpoints";
import { CHECKPOINTS } from "../../../../shared/constants";
import CheckpointOrb from "./CheckpointOrb";
import DayBar from "./DayBar";

interface DayCardProps {
  score?: DayScore;
  localDate?: string;
}

const formatDate = (localDate: string) => {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
};

export default function DayCard({ score, localDate }: DayCardProps) {
  if (!localDate || !score) {
    return (
      <div data-testid="day-card" className="grow bg-white border border-slate-200 rounded-xl p-3.5 text-center text-slate-500">
        {localDate ? `${formatDate(localDate)}: no workday recorded` : "No workdays recorded yet"}
      </div>
    );
  }

  return (
    <div data-testid="day-card" className="grow min-w-0 bg-white border border-slate-200 rounded-xl px-3.5 py-3">
      <div className="flex items-center gap-3">
        <CheckpointOrb level={score.level} />
        <div>
          <div className="text-slate-500 text-sm">{formatDate(localDate)}</div>
          <div data-testid="day-card-result" className="text-xl font-bold">
            {CHECKPOINTS.NAMES[score.level]}{score.inProgress && <span className="text-slate-500 font-normal text-base"> so far</span>}
          </div>
          <div className="text-slate-500 text-xs">
            {score.powerupsUsed} power-up(s) used · {score.lunchTaken ? "lunch taken" : "no lunch"}
          </div>
        </div>
      </div>
      <DayBar score={score} />
    </div>
  );
}
