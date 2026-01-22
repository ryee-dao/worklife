import { HashRouter, Routes, Route, Navigate } from "react-router";
import { useEffect, useState } from "react";
import TopTabs from "./TopTabs";
import Timer from "./timer/Timer";
import Settings from "./settings/Settings";
import { TimerState } from "../../../main/timerState";
import TimeSettings from "./settings/TimerSettings";
import LimitSettings from "./settings/LimitSettings";

export default function Dashboard() {
  let [timerStateObject, setTimerStateObject] = useState<TimerState>();
  useEffect(() => {
    window.electronAPI.onTimerUpdate((timerState) => {
      setTimerStateObject(timerState);
    });
  }, []);

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      <HashRouter>
        <TopTabs />
        <Routes>
          <Route path="/timer" element={<Timer timerState={timerStateObject} />}></Route>
          <Route path="/settings" element={<Settings />}>
            <Route index element={<Navigate replace to="/settings/timer" />} />
            <Route path="timer" element={<TimeSettings />}/>
            <Route path="limits" element={<LimitSettings />}/>
          </Route>

          {/* Default route */}
          <Route path="*" element={<Navigate replace to="/timer" />}></Route>
        </Routes>
      </HashRouter>
    </div>
  );
}
