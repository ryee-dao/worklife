import React from "react";
import ReactDOM from "react-dom/client"
import BreakApp from "./components/BreakApp";
import "@renderer/index.css";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
      <BreakApp/>
  </React.StrictMode>
);