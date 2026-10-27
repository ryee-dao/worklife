import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { DayScore } from "../../../../main/stats/cleanDays";
import CleanDayCalendar from "./CleanDayCalendar";
import DayCard from "./DayCard";

export default function Stats() {
  const { localDate } = useParams();
  const [scores, setScores] = useState<Record<string, DayScore>>({});
  const [totalCleanDays, setTotalCleanDays] = useState(0);

  // Reload when a day is picked, so a day that just ended shows its result
  useEffect(() => {
    window.electronAPI.getDayScores().then((dayScores) => {
      setScores(dayScores.scores);
      setTotalCleanDays(dayScores.totalCleanDays);
    });
  }, [localDate]);

  // Without a picked day, show the latest one
  const selectedDate = localDate ?? Object.keys(scores).sort().at(-1);

  return (
    <div data-testid="stats" className="grow flex flex-col sm:flex-row gap-4 p-4 overflow-auto">
      <div className="flex flex-col gap-2">
        <div>
          <span data-testid="total-clean-days" className="text-3xl font-bold">{totalCleanDays}</span>{" "}
          <span className="text-slate-500">clean days</span>
        </div>
        <CleanDayCalendar scores={scores} selectedDate={selectedDate} />
      </div>
      <div className="grow">
        <DayCard score={selectedDate ? scores[selectedDate] : undefined} localDate={selectedDate} />
      </div>
    </div>
  );
}
