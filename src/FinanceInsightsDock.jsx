import React,{useState} from "react";
import FinanceWrapped from "./FinanceWrapped.jsx";
import FinanceScenarioSimulator from "./FinanceScenarioSimulator.jsx";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";

/**
 * UI-only launcher. No finance calculations, writes, or changes to the
 * existing FinanceOverlay's keyboard/focus and close transitions.
 */
export default function FinanceInsightsDock({records,monthRows,budgetTemplate,totalBalance,userId,disabled=false}){
  const {language}=useFinanceLanguage();
  const zh=language==="zh";
  const [expanded,setExpanded]=useState(false);
  return <>
    {expanded&&<button type="button" className="mh-insights-dock__outside" aria-label={zh?"收起左侧工具":"Collapse side tools"}
      onClick={()=>setExpanded(false)} />}
    <nav className="mh-insights-dock" data-expanded={expanded?"true":"false"}
      aria-label={zh?"财务工具侧边抽屉":"Finance tools side drawer"}>
      <button type="button" className="mh-insights-dock__toggle" aria-expanded={expanded}
        aria-label={expanded?(zh?"收起工具抽屉":"Collapse tools drawer"):(zh?"展开工具抽屉":"Expand tools drawer")}
        onClick={()=>setExpanded(p=>!p)}>
        <span aria-hidden="true">{expanded?"‹":"›"}</span>
      </button>
      <div className="mh-insights-dock__items">
        <FinanceWrapped records={records} monthRows={monthRows}
          budgetTemplate={budgetTemplate} disabled={disabled} dockButton/>
        <FinanceScenarioSimulator records={records} totalBalance={totalBalance}
          userId={userId} disabled={disabled} dockButton/>
      </div>
    </nav>
  </>;
}
