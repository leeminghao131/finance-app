import React from "react";
import { createRoot } from "react-dom/client";
import FinanceVisualizerApp from "./App.jsx";
import "./style.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <FinanceVisualizerApp />
  </React.StrictMode>
);
