import { HashRouter, Routes, Route, Navigate } from "react-router";
import { useEffect, useState } from "react";
import TopTabs from "./TopTabs";
import Timer from "./timer/Timer";
import Settings from "./settings/Settings";
import { TimerState } from "@main/timer/timerState";
import TimeSettings from "./settings/TimerSettings";
import WorkdaySettings from "./settings/WorkdaySettings";
import DifficultySettings from "./settings/DifficultySettings";
import OverdueConfigsForm from "./settings/OverdueConfigsForm";
import { playWarningSound } from "@renderer/common/utils/sound";
import { DayScore } from "@main/stats/checkpoints";
import Stats from "./stats/Stats";
import AdminSettings from "./settings/AdminSettings";
import { IS_DEV } from "@renderer/common/constants";
import Tour from "./tour/Tour";
import { TourContext } from "./tour/TourContext";

// Opens a day's end-of-day card in the Stats tab
const showDay = (localDate: string) => {
  window.location.hash = `#/stats/${localDate}`;
};

export default function Dashboard() {
  const [timerStateObject, setTimerStateObject] = useState<TimerState>();
  const [todayScore, setTodayScore] = useState<DayScore | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => window.electronAPI.onTimerUpdate(setTimerStateObject), []);

  // A workday that ended while the app was closed gets its card on the next launch. Taking it marks it shown,
  // so it waits until the tour, which owns the tabs while it's open, is out of the way
  const showUnseenDay = () => {
    window.electronAPI.takeUnseenDaySummary().then((localDate) => localDate && showDay(localDate));
  };
  // The tour shows itself once, on the first run
  useEffect(() => {
    window.electronAPI.getTourSeen().then((seen) => {
      setTourOpen(!seen);
      if (seen) showUnseenDay();
    });
  }, []);
  const finishTour = () => {
    setTourOpen(false);
    showUnseenDay();
  };

  useEffect(() => window.electronAPI.onWarning(playWarningSound), []);
  useEffect(() => window.electronAPI.onTodayScore(setTodayScore), []);
  useEffect(() => window.electronAPI.onShowDay(showDay), []);

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      <HashRouter>
        <TourContext.Provider value={{ replay: () => setTourOpen(true) }}>
        {/* Inert while the tour is open, so the keyboard can't reach the stop button behind it either */}
        <div inert={tourOpen} className="contents">
        <TopTabs />
        <Routes>
          <Route path="/timer" element={<Timer timerState={timerStateObject} />}></Route>
          <Route path="/stats/:localDate?" element={<Stats todayScore={todayScore} />} />
          <Route path="/settings" element={<Settings />}>
            <Route index element={<Navigate replace to="/settings/timer" />} />
            <Route path="timer" element={<TimeSettings />} />
            <Route path="workday" element={<WorkdaySettings />} />
            <Route path="difficulty" element={<DifficultySettings />} />
            <Route path="overdue" element={<OverdueConfigsForm />} />
            {IS_DEV && <Route path="admin" element={<AdminSettings />} />}
          </Route>

          {/* Default route */}
          <Route path="*" element={<Navigate replace to="/timer" />}></Route>
        </Routes>
        </div>
        {tourOpen && timerStateObject && <Tour timerState={timerStateObject} onDone={finishTour} />}
        </TourContext.Provider>
      </HashRouter>
    </div>
  );
}
