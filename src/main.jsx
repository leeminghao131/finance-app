import React from "react";
import { createRoot } from "react-dom/client";
import FinanceVisualizerApp from "./App.jsx";
import "./style.css";
import "./financePerformanceDiagnostic.css";
import { startFinancePreviewFrameMonitor } from "./financePerformanceDiagnostic.js";

// Diagnostic panel is created only for explicitly flagged Preview URLs.
// It does not read app state, login state, settings, or user finance data.
startFinancePreviewFrameMonitor();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <FinanceVisualizerApp />
  </React.StrictMode>
);
