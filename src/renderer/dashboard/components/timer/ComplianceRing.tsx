import { ReactNode } from "react";
import { DayScore } from "../../../../main/stats/cleanDays";

interface ComplianceRingProps {
  todayScore: DayScore | null;
  children: ReactNode;
}

// Colors for the parts of the ring
const RING_COLORS = {
  compliant: "#f59e0b",  // Gold while a clean day is still possible
  partialOnly: "#94a3b8", // Silver once only a partial is left
  violating: "#ef4444",  // Red while a violation is happening
  reachable: "#fde68a",  // What's still possible today
  track: "#e2e8f0",
};

// A tick on the ring at a share of the way around, like the ½ mark
function RingTick({ share, label }: { share: number; label: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ transform: `rotate(${share * 360}deg)` }}>
      <div title={label} className="mx-auto w-1 h-[4%] bg-slate-700" /> {/* Same height as the ring is thick */}
    </div>
  );
}

export default function ComplianceRing({ todayScore, children }: ComplianceRingProps) {
  const compliantDeg = (todayScore?.compliance ?? 0) * 360;
  const reachableDeg = Math.min(1, todayScore?.bestPossible ?? 0) * 360;
  const fillColor = !todayScore
    ? RING_COLORS.track
    : todayScore.violatingNow
      ? RING_COLORS.violating
      : todayScore.cleanPossible ? RING_COLORS.compliant : RING_COLORS.partialOnly;

  return (
    <div
      data-testid="compliance-ring"
      className={`relative h-[85%] aspect-square rounded-full p-[4%] ${todayScore?.violatingNow ? "animate-pulse" : ""}`}
      style={{
        background: `conic-gradient(${fillColor} 0 ${compliantDeg}deg, ${RING_COLORS.reachable} 0 ${reachableDeg}deg, ${RING_COLORS.track} 0)`,
      }}
    >
      {todayScore && <RingTick share={todayScore.partialNeeded} label="½ partial" />}
      {/* @container lets the text inside size itself to the ring */}
      <div className="@container h-full w-full rounded-full bg-slate-50 flex flex-col justify-center items-center">
        {children}
        <span data-testid="compliance-ring-label" className="text-slate-500 text-[6cqw] font-medium tracking-wide">
          {todayScore ? `Today ${Math.round(todayScore.compliance * 100)}%` : "Day off"}
        </span>
      </div>
    </div>
  );
}
