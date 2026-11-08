import React from "react";
import ReactDOM from "react-dom/client"
import BreakApp from "./components/BreakApp";
import "@renderer/index.css";

// Opened by the web demo as a real window: the page it came from holds the simulated app
if (!window.electronAPI && window.opener?.__demo) window.electronAPI = window.opener.__demo.api;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
      <BreakApp/>
  </React.StrictMode>
);
