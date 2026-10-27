import { useNavigate } from "react-router";
import { DayScore } from "../../../../main/stats/cleanDays";

interface CleanDayCalendarProps {
  scores: Record<string, DayScore>;
  selectedDate?: string;
}

const weeksShown = 12;

// "YYYY-MM-DD" in local time
const toLocalDate = (date: Date) => date.toLocaleDateString("en-CA");

// Every day from the Sunday 12 weeks back through today, a column per week
const getCalendarDates = () => {
  const start = new Date();
  start.setDate(start.getDate() - start.getDay() - (weeksShown - 1) * 7);
  const dates: string[] = [];
  for (const day = start; day <= new Date(); day.setDate(day.getDate() + 1)) {
    dates.push(toLocalDate(day));
  }
  return dates;
};

const getSquareStyle = (score?: DayScore) => {
  if (score?.result === "CLEAN") return { className: "bg-amber-500 border-amber-500" };
  if (score?.result === "PARTIAL") {
    return { className: "border-amber-500", style: { background: "linear-gradient(135deg, #f59e0b 50%, white 50%)" } };
  }
  return { className: "bg-white border-slate-300" }; // Not clean, doesn't count, or no data, so nothing is lost
};

export default function CleanDayCalendar({ scores, selectedDate }: CleanDayCalendarProps) {
  const navigate = useNavigate();
  const today = toLocalDate(new Date());

  return (
    <div>
      <div data-testid="clean-day-calendar" className="grid grid-rows-7 grid-flow-col auto-cols-[14px] gap-[3px]">
        {getCalendarDates().map((localDate) => {
          const score = scores[localDate];
          const { className, style } = getSquareStyle(score);
          const outline = localDate === selectedDate ? "outline-2 outline-slate-800" : localDate === today ? "outline-1 outline-slate-400" : "";
          return (
            <button
              key={localDate}
              data-testid={`calendar-day-${localDate}`}
              title={`${localDate}${score?.result ? `: ${score.result}` : ""}`}
              onClick={() => navigate(`/stats/${localDate}`)}
              className={`h-[14px] w-[14px] rounded-[3px] border outline-offset-1 cursor-pointer ${className} ${outline}`}
              style={style}
            />
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 text-xs text-slate-500">
        <span><span className="inline-block w-3 h-3 align-[-2px] mr-1 rounded-sm bg-amber-500" />Clean</span>
        <span><span className="inline-block w-3 h-3 align-[-2px] mr-1 rounded-sm border border-amber-500" style={{ background: "linear-gradient(135deg, #f59e0b 50%, white 50%)" }} />Partial (½)</span>
      </div>
    </div>
  );
}
