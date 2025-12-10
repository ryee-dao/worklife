import { HashRouter, Routes, Route, Navigate } from "react-router";
import { useEffect, useState } from "react";
import TopTabs from "./TopTabs";
import Timer from "./Timer";
import Settings from "./Settings";
import { TimerState } from "../../../main/timerState";

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
          <Route path="timer" element={<Timer timerState={timerStateObject}/>}></Route>
          <Route path="settings" element={<Settings />}></Route>

          {/* Default route */}
          <Route path="*" element={<Navigate replace to="/timer" />}></Route>
        </Routes>
      </HashRouter>
    </div>
  );
}
