import React, { memo, useRef } from "react";
import FinanceWrappedStage from "./FinanceWrappedStage.jsx";

/**
 * Wrapped's scene transition has exactly ONE live scene.
 * PR #76 mounted the departing and arriving SVG scenes together for 520 ms,
 * doubling their animations, DOM, paint and language-observer work.
 * The presentation is still directional; finance data never changes.
 */
function FinanceWrappedSceneDeck({ report, mode, chapter, zh, hideNotes, display }) {
  const sceneKey = [mode, report.first, report.last, report.label, chapter].join("|");
  const previousRef = useRef({ sceneKey, chapter, direction: "forward" });
  if (previousRef.current.sceneKey !== sceneKey) {
    previousRef.current = {
      sceneKey,
      chapter,
      direction: chapter < previousRef.current.chapter ? "back" : "forward",
    };
  }
  return <div className="mh-wrap-deck" aria-live="polite" aria-atomic="true">
    <div key={sceneKey}
      className={"mh-wrap-deck__page mh-wrap-deck__page--in-" + previousRef.current.direction}>
      <FinanceWrappedStage report={report} mode={mode} chapter={chapter}
        zh={zh} hideNotes={hideNotes} display={display}/>
    </div>
  </div>;
}

// Auto-play state and controls should not rerender the unchanged SVG scene.
export default memo(FinanceWrappedSceneDeck);
