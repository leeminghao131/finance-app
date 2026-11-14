import React,{useRef,useState} from "react";
import FinanceWrapped from "./FinanceWrapped.jsx";
import FinanceScenarioSimulator from "./FinanceScenarioSimulator.jsx";
import FinanceMonthComparison from "./FinanceMonthComparison.jsx";
import FinanceSavingsGoals from "./FinanceSavingsGoals.jsx";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";

/** A launcher and its existing full-size card inside an independent floating popup. */
function DockCardPopup({title,icon,children,disabled=false,widthClass="max-w-5xl"}){
  const [open,setOpen]=useState(false);
  const triggerRef=useRef(null);
  return <>
    <button ref={triggerRef} type="button" disabled={disabled} onClick={()=>setOpen(true)}
      aria-haspopup="dialog" aria-expanded={open} className="mh-insights-dock__button">
      <span className="mh-insights-dock__label">{title}</span>
      <span className="mh-insights-dock__icon" aria-hidden="true">{icon}</span>
    </button>
    <FinanceOverlay open={open} title={title} onClose={()=>setOpen(false)}
      triggerRef={triggerRef} widthClass={widthClass}>
      {children}
    </FinanceOverlay>
  </>;
}

/**
 * Stage 1.2: 4 separate, accessible popup launchers. Dashboard data stays in App
 * and the original Comparison/Goals components are reused without changing
 * any record, goal write, budget calculation or finance service.
 */
export default function FinanceInsightsDock({
  records,monthRows,budgetTemplate,totalBalance,userId,
  goals=[],onSaveSavingsGoals,savingsAvailability,budgetMonth,calculationError,
  disabled=false,
}){
  const {language}=useFinanceLanguage();
  const zh=language==="zh";
  const [expanded,setExpanded]=useState(false);
  return <>
    {expanded&&<button type="button" className="mh-insights-dock__outside"
      aria-label={zh?"收起左侧工具":"Collapse side tools"} onClick={()=>setExpanded(false)}/>}
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
        <DockCardPopup title={zh?"月度财务对比":"Month Comparison"} icon="📊" disabled={disabled}>
          <FinanceMonthComparison records={records}/>
        </DockCardPopup>
        <DockCardPopup title={zh?"储蓄目标":"Savings Goals"} icon="🎯" disabled={disabled}>
          <FinanceSavingsGoals goals={goals} onSave={onSaveSavingsGoals}
            disabled={disabled} savingsAvailability={savingsAvailability}
            calculationError={calculationError} budgetMonth={budgetMonth}/>
        </DockCardPopup>
      </div>
    </nav>
  </>;
}
