import React, { useLayoutEffect, useRef, useState } from "react";
import FinanceWrappedStage from "./FinanceWrappedStage.jsx";

/**
 * Two-layer, direction-aware slide deck. The departing page remains visible
 * for the short transition only; the finance report is passed through
 * unchanged and neither layer performs writes or financial calculations.
 */
export default function FinanceWrappedSceneDeck({ report, mode, chapter, zh, hideNotes, display }) {
  const sceneKey = [mode, report.first, report.last, report.label, chapter].join("|");
  const previousRef = useRef({ key: sceneKey, chapter, mode, report });
  const [departure, setDeparture] = useState(null);
  const [direction, setDirection] = useState(1);

  useLayoutEffect(() => {
    const previous = previousRef.current;
    if (previous.key === sceneKey) {
      previousRef.current = { key: sceneKey, chapter, mode, report };
      return undefined;
    }
    setDeparture(previous);
    setDirection(chapter < previous.chapter ? -1 : 1);
    previousRef.current = { key: sceneKey, chapter, mode, report };
    const timeout = window.setTimeout(() => setDeparture(null), 520);
    return () => window.clearTimeout(timeout);
  }, [sceneKey, chapter, mode, report]);

  const suffix = direction < 0 ? "back" : "forward";
  return <div className="mh-wrap-deck" aria-live="polite" aria-atomic="true">
    {departure && <div key={"out-" + departure.key}
      className={"mh-wrap-deck__page mh-wrap-deck__page--out-" + suffix}
      aria-hidden="true" inert="">
      <FinanceWrappedStage report={departure.report} mode={departure.mode}
        chapter={departure.chapter} zh={zh} hideNotes={hideNotes} display={display}/>
    </div>}
    <div key={"in-" + sceneKey}
      className={"mh-wrap-deck__page mh-wrap-deck__page--in-" + suffix}>
      <FinanceWrappedStage report={report} mode={mode} chapter={chapter}
        zh={zh} hideNotes={hideNotes} display={display}/>
    </div>
  </div>;
}
