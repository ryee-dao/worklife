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

export default function Dashboard() {
  const [timerStateObject, setTimerStateObject] = useState<TimerState>();
  useEffect(() => {
    window.electronAPI.onTimerUpdate((timerState) => {
      setTimerStateObject(timerState);
    });
  }, []);

  useEffect(() => window.electronAPI.onWarning(playWarningSound), []);

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      <HashRouter>
        <TopTabs />
        <Routes>
          <Route path="/timer" element={<Timer timerState={timerStateObject} />}></Route>
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
