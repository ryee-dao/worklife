import { AlarmClockPlus, Hourglass, Sandwich, TreePalm, Zap } from "lucide-react";
import { DifficultyConfigs } from "../../../../main/difficulty/difficultyConfigs";
import { LEVEL_COLORS } from "../stats/checkpointStyles";

export type PresetLevel = "EASY" | "NORMAL" | "HARD";
export type DifficultyValues = DifficultyConfigs["custom"];


interface DifficultyCardProps {
  level: PresetLevel;
  name: string;
  values: DifficultyValues;
  maximums: DifficultyValues; // The largest of each across the presets, so each bar reads against the others
  selected: boolean;
  onSelect: () => void;
}

// The sun climbs higher and burns hotter the harder the day
const sunByLevel: Record<PresetLevel, { y: number; r: number; color: string; sky: string }> = {
  EASY: { y: 82, r: 11, color: LEVEL_COLORS[2], sky: "#ffedd5" },
  NORMAL: { y: 56, r: 13, color: LEVEL_COLORS[3], sky: "#fef3c7" },
  HARD: { y: 28, r: 16, color: LEVEL_COLORS[4], sky: "#fde68a" },
};

export const formatDuration = (ms: number) => {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
};

function Emblem({ level }: { level: PresetLevel }) {
  const sun = sunByLevel[level];
  return (
    <svg viewBox="0 0 200 110" preserveAspectRatio="xMidYMid slice" className="w-full h-16 sm:h-24 rounded-lg" aria-hidden>
      <defs>
        <linearGradient id={`sky-${level}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sun.sky} />
          <stop offset="1" stopColor="#fff7ed" />
        </linearGradient>
      </defs>
      <rect width="200" height="110" fill={`url(#sky-${level})`} />
      <circle cx="100" cy={sun.y} r={sun.r + 6} fill={sun.color} opacity=".25" />
      <circle cx="100" cy={sun.y} r={sun.r} fill={sun.color} />
      <path d="M0 95 Q50 80 100 92 T200 88 V110 H0Z" fill="#cbd5e1" />
      <path d="M0 102 Q60 92 120 100 T200 98 V110 H0Z" fill="#94a3b8" />
    </svg>
  );
}

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="hidden sm:block flex-1 min-w-0 h-2 rounded bg-slate-200 overflow-hidden">
      <div className="h-full rounded" style={{ width: `${Math.min(1, value / max) * 100}%`, background: color }} />
    </div>
  );
}

function StatRow({ title, children }: { title: string; children: React.ReactNode }) {
  return <div title={title} className="flex items-center gap-1.5 sm:gap-2 h-5 sm:h-6">{children}</div>;
}

const statValue = "ml-auto sm:ml-0 sm:w-14 text-right text-[10px] sm:text-xs font-semibold tabular-nums text-slate-600 whitespace-nowrap";
const statIcon = "size-3.5 sm:size-4.5 shrink-0";

// A character-select card: a picture, the name, and what the day gives you as bars and numbers. Narrow windows drop the bars and keep the numbers
export default function DifficultyCard({ level, name, values, maximums, selected, onSelect }: DifficultyCardProps) {
  return (
    <button
      data-testid={`difficulty-card-${level}`}
      aria-pressed={selected}
      onClick={onSelect}
      className={`relative min-w-0 flex flex-col gap-0.5 sm:gap-1 rounded-2xl border-2 bg-white p-2 sm:p-3 text-left cursor-pointer
        transition-all duration-200 ease-out
        ${selected
          ? "border-slate-700 -translate-y-1.5 shadow-lg"
          : "border-slate-200 saturate-[.35] opacity-80 hover:-translate-y-0.5 hover:opacity-100"}`}
    >
      <Emblem level={level} />
      <span className="text-center font-extrabold uppercase tracking-wide sm:tracking-[.2em] text-slate-700 text-xs sm:text-base my-0.5 sm:my-1">{name}</span>

      <StatRow title="Break length">
        <TreePalm className={`${statIcon} text-green-700`} />
        <StatBar value={values.breakDurationMs} max={maximums.breakDurationMs} color="#15803d" />
        <span className={statValue}>{formatDuration(values.breakDurationMs)}</span>
      </StatRow>
      <StatRow title="Power-ups a day: snooze, or skip a break">
        <span className="flex-1 min-w-0 flex gap-px">
          {Array.from({ length: maximums.allottedPowerups }, (_, i) => (
            <Zap key={i} className={`${statIcon} ${i > 0 ? "hidden sm:block" : ""} ${i < values.allottedPowerups ? "text-amber-500 fill-amber-400" : "text-slate-300"}`} />
          ))}
        </span>
        <span className={statValue}>{values.allottedPowerups}</span>
      </StatRow>
      <StatRow title="Snooze length">
        <AlarmClockPlus className={`${statIcon} text-slate-600`} />
        <StatBar value={values.snoozeDurationMs} max={maximums.snoozeDurationMs} color="#64748b" />
        <span className={statValue}>+{formatDuration(values.snoozeDurationMs)}</span>
      </StatRow>
      <StatRow title="Lunch length">
        <Sandwich className={`${statIcon} text-orange-500`} />
        <StatBar value={values.lunchDurationMs} max={maximums.lunchDurationMs} color="#f97316" />
        <span className={statValue}>{formatDuration(values.lunchDurationMs)}</span>
      </StatRow>
      <StatRow title="Stopped: lose a checkpoint every">
        <Hourglass className={`${statIcon} text-red-600`} />
        <StatBar value={values.checkpointDecayMs} max={maximums.checkpointDecayMs} color="#dc2626" />
        <span className={statValue}>{formatDuration(values.checkpointDecayMs)}</span>
      </StatRow>

      {selected && (
        <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent border-t-slate-700" />
      )}
    </button>
  );
}
