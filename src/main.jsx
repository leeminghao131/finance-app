import React from "react";
import { createRoot } from "react-dom/client";
import FinanceVisualizerApp from "./App.jsx";
import { isTestEnvironment } from "./supabaseClient";
import FinanceRenderDiagnostics from "./FinanceRenderDiagnostics.jsx";
import "./style.css";
import "./financeRenderDiagnostics.css";

// Opt-in TEST preview diagnostic only. No production user sees this tool.
const showRenderLab = isTestEnvironment &&
  new URLSearchParams(window.location.search).get("perfLab") === "1";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <FinanceVisualizerApp />
    {showRenderLab && <FinanceRenderDiagnostics />}
  </React.StrictMode>
);
