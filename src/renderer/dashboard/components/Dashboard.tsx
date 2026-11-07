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
import { TourUpdate } from "@shared/tour/session";

// Opens a day's end-of-day card in the Stats tab
const showDay = (localDate: string) => {
  window.location.hash = `#/stats/${localDate}`;
};

export default function Dashboard() {
  const [timerStateObject, setTimerStateObject] = useState<TimerState>();
  const [todayScore, setTodayScore] = useState<DayScore | null>(null);
  const [tour, setTour] = useState<TourUpdate | null>(); // Undefined until the app has said whether one is on
  // Fetched as well as subscribed: the update sent as the page loads can land before this subscribes, as the break window found
  useEffect(() => {
    window.electronAPI.getTimerState().then(setTimerStateObject);
    return window.electronAPI.onTimerUpdate(setTimerStateObject);
  }, []);
  useEffect(() => {
    window.electronAPI.getTour().then(setTour);
    return window.electronAPI.onTourUpdate(setTour);
  }, []);

  // A workday that ended while the app was closed gets its card on the next launch. Taking it marks it shown,
  // so it waits until no tour, which owns the tabs while it's open, is in the way
  useEffect(() => {
    if (tour === null) window.electronAPI.takeUnseenDaySummary().then((localDate) => localDate && showDay(localDate));
  }, [tour]);

  useEffect(() => window.electronAPI.onWarning(playWarningSound), []);
  useEffect(() => window.electronAPI.onTodayScore(setTodayScore), []);
  useEffect(() => window.electronAPI.onShowDay(showDay), []);

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      <HashRouter>
        {/* Inert while the tour is open, so the keyboard can't reach the stop button behind it either */}
        <div inert={!!tour} className="contents">
        <TopTabs />
        <button
          data-testid="replay-tour"
          title="Show the tour"
          onClick={() => window.electronAPI.startTour()}
          className="fixed bottom-3 right-3 z-40 size-7 rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-500 cursor-pointer hover:border-slate-400 hover:text-slate-900"
        >
          ?
        </button>
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
        {tour && <Tour tour={tour} />}
      </HashRouter>
    </div>
  );
}
