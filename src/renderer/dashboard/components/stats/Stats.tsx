import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { DayScore } from "../../../../main/stats/checkpoints";
import MonthCalendar from "./MonthCalendar";
import DayCard from "./DayCard";
import TodayPanel from "./TodayPanel";

interface StatsProps {
  todayScore: DayScore | null;
}

export default function Stats({ todayScore }: StatsProps) {
  const { localDate } = useParams();
  const [scores, setScores] = useState<Record<string, DayScore>>({});

  // Reload when a day is picked, so a day that just ended shows its result
  useEffect(() => {
    window.electronAPI.getDayScores().then(setScores);
  }, [localDate]);

  // Today comes from the live score, which updates every second
  const allScores = todayScore ? { ...scores, [todayScore.localDate]: todayScore } : scores;
  // Without a picked day, show today, or the latest day there is
  const selectedDate = localDate ?? todayScore?.localDate ?? Object.keys(allScores).sort().at(-1);

  return (
    <div data-testid="stats" className="grow flex flex-col gap-3 p-3 sm:p-4 overflow-auto">
      <TodayPanel score={todayScore} />
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <MonthCalendar scores={allScores} selectedDate={selectedDate} />
        <DayCard score={selectedDate ? allScores[selectedDate] : undefined} localDate={selectedDate} />
      </div>
    </div>
  );
}
