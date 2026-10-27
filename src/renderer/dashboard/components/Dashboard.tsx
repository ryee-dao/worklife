import { HashRouter, Routes, Route, Navigate } from "react-router";
import { useEffect, useState } from "react";
import TopTabs from "./TopTabs";
import Timer from "./timer/Timer";
import Settings from "./settings/Settings";
import { TimerState } from "../../../main/timer/timerState";
import TimeSettings from "./settings/TimerSettings";
import WorkdaySettings from "./settings/WorkdaySettings";
import DifficultySettings from "./settings/DifficultySettings";
import OverdueConfigsForm from "./settings/OverdueConfigsForm";
import { playWarningSound } from "../../common/utils/sound";
import { DayScore } from "../../../main/stats/cleanDays";
import Stats from "./stats/Stats";

// Opens a day's end-of-day card in the Stats tab
const showDay = (localDate: string) => {
  window.location.hash = `#/stats/${localDate}`;
};

export default function Dashboard() {
  const [timerStateObject, setTimerStateObject] = useState<TimerState>();
  const [todayScore, setTodayScore] = useState<DayScore | null>(null);
  useEffect(() => {
    window.electronAPI.onTimerUpdate((timerState) => {
      setTimerStateObject(timerState);
    });
  }, []);

  useEffect(() => window.electronAPI.onWarning(playWarningSound), []);
  useEffect(() => window.electronAPI.onTodayScore(setTodayScore), []);
  useEffect(() => window.electronAPI.onShowDay(showDay), []);
  // A workday that ended while the app was closed gets its card on the next launch
  useEffect(() => {
    window.electronAPI.takeUnseenDaySummary().then((localDate) => localDate && showDay(localDate));
  }, []);

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      <HashRouter>
        <TopTabs />
        <Routes>
          <Route path="/timer" element={<Timer timerState={timerStateObject} todayScore={todayScore} />}></Route>
          <Route path="/stats/:localDate?" element={<Stats />} />
          <Route path="/settings" element={<Settings />}>
            <Route index element={<Navigate replace to="/settings/timer" />} />
            <Route path="timer" element={<TimeSettings />} />
            <Route path="workday" element={<WorkdaySettings />} />
            <Route path="difficulty" element={<DifficultySettings />} />
            <Route path="overdue" element={<OverdueConfigsForm />} />
          </Route>

          {/* Default route */}
          <Route path="*" element={<Navigate replace to="/timer" />}></Route>
        </Routes>
      </HashRouter>
    </div>
  );
}
