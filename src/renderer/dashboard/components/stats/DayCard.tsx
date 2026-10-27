import { DayResult, DayScore } from "../../../../main/stats/cleanDays";

interface DayCardProps {
  score?: DayScore;
  localDate?: string;
}

const resultText: Record<DayResult | "IN_PROGRESS" | "DOESNT_COUNT", { badge: string; text: string }> = {
  CLEAN: { badge: "★", text: "Clean day" },
  PARTIAL: { badge: "½", text: "Partial clean" },
  NOT_CLEAN: { badge: "·", text: "Not clean" },
  IN_PROGRESS: { badge: "…", text: "Day in progress" },
  DOESNT_COUNT: { badge: "–", text: "Doesn't count" },
};

const pieceColors = {
  COMPLIANT: "bg-amber-500",
  VIOLATION: "bg-red-500",
  NOT_RUNNING: "bg-slate-300",
};

const formatTime = (epochMs: number) => new Date(epochMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const formatDate = (localDate: string) => {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
};

export default function DayCard({ score, localDate }: DayCardProps) {
  if (!localDate || !score) {
    return (
      <div data-testid="day-card" className="border border-slate-300 rounded-lg p-4 text-center text-slate-500">
        {localDate ? `${formatDate(localDate)}: no workday recorded` : "No workdays recorded yet"}
      </div>
    );
  }

  const { badge, text } = resultText[score.result ?? (score.inProgress ? "IN_PROGRESS" : "DOESNT_COUNT")];
  const workdayMs = score.workEnd - score.workStart;

  return (
    <div data-testid="day-card" className="border border-slate-300 rounded-lg p-4 text-center">
      <div className="text-slate-500">{formatDate(localDate)}</div>
      <div className="text-4xl">{badge}</div>
      <div data-testid="day-card-result" className="text-xl font-bold">{text}</div>
      <div>
        {Math.round(score.compliance * 100)}% compliant · {Math.round(score.partialNeeded * 100)}% needed for ½
      </div>
      <div className="text-slate-500 text-sm mt-2">
        {score.allottedBreaks - score.skipsUsed} skip(s) and {score.allottedSnoozes - score.snoozesUsed} snooze(s) unused
      </div>

      {/* The workday, minute by minute: where it was compliant and where it wasn't */}
      <div data-testid="day-card-timeline" className="relative h-3 mt-4 rounded bg-slate-100 overflow-hidden">
        {score.pieces.map((piece) => (
          <div
            key={piece.start}
            className={`absolute top-0 bottom-0 ${pieceColors[piece.kind]}`}
            style={{
              left: `${((piece.start - score.workStart) / workdayMs) * 100}%`,
              width: `${((piece.end - piece.start) / workdayMs) * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>{formatTime(score.workStart)}</span>
        <span className="flex gap-3">
          <span><span className="inline-block w-2 h-2 mr-1 bg-amber-500" />compliant</span>
          <span><span className="inline-block w-2 h-2 mr-1 bg-red-500" />violation</span>
          <span><span className="inline-block w-2 h-2 mr-1 bg-slate-300" />not running</span>
        </span>
        <span>{formatTime(score.workEnd)}</span>
      </div>
    </div>
  );
}
