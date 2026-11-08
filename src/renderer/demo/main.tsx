import React from "react";
import ReactDOM from "react-dom/client";
import Dashboard from "@renderer/dashboard/components/Dashboard";
import DemoBreakWindow from "./DemoBreakWindow";
import { createDemoElectronAPI } from "./demoElectronAPI";
import "@renderer/index.css";

declare global {
  interface Window {
    __demo: ReturnType<typeof createDemoElectronAPI>; // Lets tests move the demo's clock
  }
}

// The dashboard talks to window.electronAPI. In the browser that's a timer simulated in the page
const demo = createDemoElectronAPI();
window.electronAPI = demo.api;
window.__demo = demo;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Dashboard />
    <DemoBreakWindow getLevels={demo.getOverdueLevels} />
  </React.StrictMode>
);
