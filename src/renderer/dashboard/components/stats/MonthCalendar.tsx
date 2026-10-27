import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { DayScore } from "../../../../main/stats/checkpoints";
import { CHECKPOINTS } from "../../../../shared/constants";
import { FillMode, getLevelFill, LEVEL_COLORS } from "./checkpointStyles";

interface MonthCalendarProps {
  scores: Record<string, DayScore>;
  selectedDate?: string;
}

const maxLevel = CHECKPOINTS.NAMES.length - 1;
const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fillModeNames: Record<FillMode, string> = { SHARE: "Fill by checkpoint", WHOLE: "Whole day" };

// "YYYY-MM-DD" in local time
const toLocalDate = (date: Date) => date.toLocaleDateString("en-CA");

// "YYYY-MM", the month a local date is in
const toMonth = (localDate: string) => localDate.slice(0, 7);

const addMonths = (month: string, count: number) => {
  const [year, monthIndex] = month.split("-").map(Number);
  return toLocalDate(new Date(year, monthIndex - 1 + count, 1)).slice(0, 7);
};

// Every day of the month, after blanks for the weekdays before the 1st
const getMonthDays = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number);
  const firstWeekday = new Date(year, monthIndex - 1, 1).getDay();
  const dayCount = new Date(year, monthIndex, 0).getDate();
  const days = Array.from({ length: dayCount }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
  return [...Array<null>(firstWeekday).fill(null), ...days];
};

export default function MonthCalendar({ scores, selectedDate }: MonthCalendarProps) {
  const navigate = useNavigate();
  const today = toLocalDate(new Date());
  const [month, setMonth] = useState(toMonth(selectedDate ?? today));
  const [fillMode, setFillMode] = useState<FillMode>("SHARE");

  // Show the month of the day picked, like a past day's end-of-day card
  useEffect(() => {
    if (selectedDate) setMonth(toMonth(selectedDate));
  }, [selectedDate]);

  // Radiant counts as a whole day, Shine as ¾, and so on. Today counts once it's over
  const monthTotal = Object.values(scores)
    .filter((score) => toMonth(score.localDate) === month && !score.inProgress)
    .reduce((total, score) => total + score.level / maxLevel, 0);
  const monthName = new Date(`${month}-01T12:00:00`).toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <div data-testid="month-calendar" className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 sm:w-[22rem] shrink-0">
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-1.5">
          <button data-testid="calendar-previous-month" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}
            className="size-6 border border-slate-300 rounded-md cursor-pointer">‹</button>
          <b data-testid="calendar-month" className="whitespace-nowrap leading-tight">{monthName}</b>
          <button data-testid="calendar-next-month" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}
            disabled={month >= toMonth(today)} className="size-6 border border-slate-300 rounded-md cursor-pointer disabled:opacity-30 disabled:cursor-default">›</button>
        </div>
        <div title="Radiant counts as 1 day, Shine as ¾, Glow as ½, Glimmer as ¼" className="whitespace-nowrap">
          <b data-testid="month-total" className="text-lg">{Number(monthTotal.toFixed(2))}</b>{" "}
          <span className="text-slate-500">days</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekdayNames.map((weekdayName) => (
          <div key={weekdayName} className="text-[11px] text-slate-500 text-center">{weekdayName}</div>
        ))}
        {getMonthDays(month).map((localDate, index) => {
          if (!localDate) return <div key={`blank-${index}`} />;
          const score = scores[localDate];
          const isFuture = localDate > today;
          const outline = localDate === selectedDate ? "outline-2 outline-slate-800" : localDate === today ? "outline-1 outline-slate-400" : "";
          return (
            <button
              key={localDate}
              data-testid={`calendar-day-${localDate}`}
              title={score ? `${localDate}: ${CHECKPOINTS.NAMES[score.level]}${score.inProgress ? " so far" : ""}` : localDate}
              disabled={isFuture}
              onClick={() => navigate(`/stats/${localDate}`)}
              className={`relative h-9 border rounded-md outline-offset-1 text-left text-[10px] leading-none p-1 text-stone-700
                enabled:cursor-pointer disabled:opacity-35 ${score?.inProgress ? "opacity-60" : ""} ${outline}`}
              style={score ? getLevelFill(score.level, fillMode) : { borderColor: "#e2e8f0" }}
            >
              <span className="absolute top-0.5 left-1">{Number(localDate.slice(8))}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-500">
        {CHECKPOINTS.NAMES.map((name, level) => (
          <span key={name}>
            <i className="inline-block size-2.5 mr-1 rounded-sm border border-slate-200 align-[-1px]" style={{ background: LEVEL_COLORS[level] }} />
            {name}
          </span>
        ))}
        <button data-testid="calendar-fill-mode" onClick={() => setFillMode(fillMode === "SHARE" ? "WHOLE" : "SHARE")}
          className="ml-auto underline cursor-pointer">
          {fillModeNames[fillMode === "SHARE" ? "WHOLE" : "SHARE"]}
        </button>
      </div>
    </div>
  );
}
