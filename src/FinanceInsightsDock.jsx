import {localDateMY} from "./financeCalendar.js";
import React,{useEffect,useLayoutEffect,useRef,useState} from "react";
import FinanceWrapped from "./FinanceWrapped.jsx";
import FinanceActivityPanel from "./FinanceActivityPanel.jsx";
import FinanceScenarioSimulator from "./FinanceScenarioSimulator.jsx";
import FinanceMonthComparison from "./FinanceMonthComparison.jsx";
import FinanceSavingsGoals from "./FinanceSavingsGoals.jsx";
import FinanceOverlay from "./FinanceOverlay.jsx";
import FinanceDataToolsLauncher from "./FinanceDataToolsLauncher.jsx";
import FinanceClaimTracker from "./FinanceClaimTracker.jsx";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";
import {readDockOrder,saveDockOrder,moveDockItem} from "./financeDockOrder.js";

/** Original floating panels and their saved finance logic remain untouched. */
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

/** Long-hold to reorder only the drawer launchers, never their stored data. */
export default function FinanceInsightsDock({
  records,monthRows,budgetTemplate,totalBalance,userId,asOfDate=localDateMY(),
  goals=[],onSaveSavingsGoals,savingsAvailability,budgetMonth,calculationError,
  disabled=false,onOpenStage2Tool=()=>{},onOpenDataTool=()=>{},
  activities=[],activityLinks=[],onCreateActivity,onUpdateActivity,onLinkActivity,onUnlinkActivity,
  claims=[],claimRepayments=[],methodsForClaims=[],onCreateClaim,onSubmitClaim,onCancelClaim,
  onRepayClaim,onVoidClaimRepayment,claimOpenRequest=null,onClaimOpenRequestHandled=()=>{},
  activityOpenRequest=0,activityStatusTriggerRef=null,onActivityOpenRequestHandled=()=>{},
}){
  const {language}=useFinanceLanguage(),zh=language==="zh";
  const [expanded,setExpanded]=useState(false);
  const [suppressHover,setSuppressHover]=useState(false);
  const [order,setOrder]=useState(()=>readDockOrder(userId));
  const [draggingId,setDraggingId]=useState(null);
  const [ghostY,setGhostY]=useState(null);
  const orderRef=useRef(order),itemsRef=useRef(null),dockRef=useRef(null);
  const pointerRef=useRef(null),cleanupRef=useRef(null),beforeRectsRef=useRef(null);
  const suppressClickRef=useRef(false);
  useEffect(()=>{
    cleanupRef.current?.();
    const saved=readDockOrder(userId);
    orderRef.current=saved;setOrder(saved);
  },[userId]);
  useEffect(()=>()=>cleanupRef.current?.(),[]);
  useLayoutEffect(()=>{
    const previous=beforeRectsRef.current;
    if(!previous)return;
    beforeRectsRef.current=null;
    if(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;
    itemsRef.current?.querySelectorAll("[data-dock-id]").forEach(element=>{
      const id=element.dataset.dockId;
      const old=previous.get(id);
      const diff=old===undefined?0:old-element.getBoundingClientRect().top;
      if(Math.abs(diff)>1&&id!==draggingId)
        element.animate([{transform:"translateY("+diff+"px)"},{transform:"translateY(0)"}],
          {duration:180,easing:"cubic-bezier(.2,.8,.2,1)"});
    });
  },[order,draggingId]);

  const beginLongPress=(event,id)=>{
    if(disabled||event.button!==0||event.isPrimary===false||pointerRef.current)return;
    if(event.target.closest("input,textarea,select"))return;
    const press={id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,active:false,timer:null};
    pointerRef.current=press;
    const stopTouchScroll=e=>{if(pointerRef.current===press&&press.active&&e.cancelable)e.preventDefault();};
    const cleanup=()=>{
      window.clearTimeout(press.timer);
      window.removeEventListener("pointermove",move);
      window.removeEventListener("pointerup",finish);
      window.removeEventListener("pointercancel",finish);
      window.removeEventListener("touchmove",stopTouchScroll);
      if(pointerRef.current===press)pointerRef.current=null;
      if(cleanupRef.current===cleanup)cleanupRef.current=null;
    };
    const move=e=>{
      if(e.pointerId!==press.pointerId)return;
      if(!press.active){
        if(Math.hypot(e.clientX-press.startX,e.clientY-press.startY)>9)cleanup();
        return;
      }
      if(e.cancelable)e.preventDefault();
      setGhostY(e.clientY);
      const list=itemsRef.current;
      if(!list)return;
      const box=list.getBoundingClientRect();
      if(e.clientY<box.top+35)list.scrollTop-=12;
      if(e.clientY>box.bottom-35)list.scrollTop+=12;
      const elements=Array.from(list.querySelectorAll("[data-dock-id]"));
      const nearest=elements.reduce((best,node)=>{
        const rect=node.getBoundingClientRect();
        const distance=Math.abs((rect.top+rect.bottom)/2-e.clientY);
        return !best||distance<best.distance?{id:node.dataset.dockId,distance}:best;
      },null);
      if(!nearest)return;
      const next=moveDockItem(orderRef.current,press.id,nearest.id);
      if(next.join("|")===orderRef.current.join("|"))return;
      beforeRectsRef.current=new Map(elements.map(node=>[node.dataset.dockId,node.getBoundingClientRect().top]));
      orderRef.current=next;setOrder(next);
    };
    const finish=e=>{
      if(e.pointerId!==press.pointerId)return;
      if(press.active){
        // A long-press must never also click the underlying modal launcher.
        suppressClickRef.current=true;
        window.setTimeout(()=>{suppressClickRef.current=false;},180);
        saveDockOrder(userId,orderRef.current);
      }
      cleanup();setDraggingId(null);setGhostY(null);
    };
    press.timer=window.setTimeout(()=>{
      if(pointerRef.current!==press)return;
      press.active=true;
      setDraggingId(id);setGhostY(press.startY);
      window.addEventListener("touchmove",stopTouchScroll,{passive:false});
    },420);
    cleanupRef.current=cleanup;
    window.addEventListener("pointermove",move,{passive:false});
    window.addEventListener("pointerup",finish);
    window.addEventListener("pointercancel",finish);
  };
  const slots=[
    {id:"wrapped",label:zh?"财务回顾":"Finance Wrapped",icon:"🎞️",node:
      <FinanceWrapped records={records} monthRows={monthRows}
        budgetTemplate={budgetTemplate} activities={activities} activityLinks={activityLinks}
        disabled={disabled} dockButton/>},
    {id:"activity",label:zh?"旅行／活动记账":"Activity Mode",icon:"🎒",node:
      <FinanceActivityPanel activities={activities} links={activityLinks}
        records={records} onCreate={onCreateActivity} onUpdate={onUpdateActivity}
        onLink={onLinkActivity} onUnlink={onUnlinkActivity} disabled={disabled} dockButton
        activityOpenRequest={activityOpenRequest} activityStatusTriggerRef={activityStatusTriggerRef}
        onActivityOpenRequestHandled={onActivityOpenRequestHandled}/>},
    {id:"simulator",label:zh?"情境模拟":"Scenario Simulator",icon:"🧮",node:
      <FinanceScenarioSimulator records={records} totalBalance={totalBalance}
        userId={userId} asOfDate={asOfDate} disabled={disabled} dockButton/>},
    {id:"comparison",label:zh?"月度财务对比":"Month Comparison",icon:"📊",node:
      <DockCardPopup title={zh?"月度财务对比":"Month Comparison"} icon="📊" disabled={disabled}>
        <FinanceMonthComparison records={records}/>
      </DockCardPopup>},
    {id:"savings",label:zh?"储蓄目标":"Savings Goals",icon:"🎯",node:
      <DockCardPopup title={zh?"储蓄目标":"Savings Goals"} icon="🎯" disabled={disabled}>
        <FinanceSavingsGoals goals={goals} onSave={onSaveSavingsGoals}
          disabled={disabled} savingsAvailability={savingsAvailability}
          calculationError={calculationError} budgetMonth={budgetMonth}/>
      </DockCardPopup>},
    {id:"bills",label:zh?"固定账单":"Recurring Bills",icon:"🗓️",node:
      <button type="button" disabled={disabled} aria-haspopup="dialog"
        aria-label={zh?"打开固定账单":"Open Recurring Bills"}
        onClick={e=>onOpenStage2Tool("bill",e.currentTarget)}
        className="mh-insights-dock__button">
        <span className="mh-insights-dock__label">{zh?"固定账单":"Recurring Bills"}</span>
        <span className="mh-insights-dock__icon" aria-hidden="true">🗓️</span>
      </button>},
    {id:"review",label:zh?"异常记录复查":"Review Inbox",icon:"🔎",node:
      <button type="button" disabled={disabled} aria-haspopup="dialog"
        aria-label={zh?"打开异常记录复查":"Open Review Inbox"}
        onClick={e=>onOpenStage2Tool("review",e.currentTarget)}
        className="mh-insights-dock__button">
        <span className="mh-insights-dock__label">{zh?"异常记录复查":"Review Inbox"}</span>
        <span className="mh-insights-dock__icon" aria-hidden="true">🔎</span>
      </button>},
    {id:"accounts",label:zh?"余额对账":"Balance Check",icon:"🏦",node:
      <button type="button" disabled={disabled} aria-haspopup="dialog"
        aria-label={zh?"打开账户余额对账":"Open Balance Reconciliation"}
        onClick={e=>onOpenStage2Tool("accounts",e.currentTarget)}
        className="mh-insights-dock__button">
        <span className="mh-insights-dock__label">{zh?"余额对账":"Balance Check"}</span>
        <span className="mh-insights-dock__icon" aria-hidden="true">🏦</span>
      </button>},
    {id:"claims",label:zh?"垫付报销":"Claim Tracker",icon:"🧾",node:
      <FinanceClaimTracker claims={claims} repayments={claimRepayments}
        methods={[...new Set([...((methodsForClaims)||[]),...claims.map(c=>c.method),...claimRepayments.map(r=>r.method)])]}
        userId={userId} disabled={disabled}
        onCreate={onCreateClaim} onSubmitClaim={onSubmitClaim}
        onCancelClaim={onCancelClaim} onRepay={onRepayClaim}
        onVoidRepayment={onVoidClaimRepayment}
        openRequest={claimOpenRequest} onOpenRequestHandled={onClaimOpenRequestHandled}/>},
    {id:"data-tools",label:zh?"导入／导出":"Import / Export",icon:"⇅",node:
      <FinanceDataToolsLauncher disabled={disabled} onOpen={onOpenDataTool}/>}

  ];
  const dragging=slots.find(s=>s.id===draggingId);
  return <>
    {!expanded&&<button type="button"
      className="mh-insights-dock__mobile-launcher"
      aria-label={zh?"打开财务工具抽屉":"Open finance tools drawer"}
      title={zh?"财务工具":"Finance tools"}
      aria-controls="mh-insights-dock-panel" aria-expanded={false}
      onClick={()=>{setSuppressHover(false);setExpanded(true);}}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="23" height="23"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </button>}
    {expanded&&<button type="button" className="mh-insights-dock__outside"
      aria-label={zh?"收起左侧工具":"Collapse side tools"} onClick={()=>{setExpanded(false);setSuppressHover(true);}}/>}
    <nav ref={dockRef} id="mh-insights-dock-panel" className="mh-insights-dock" data-expanded={expanded?"true":"false"}
      data-suppress-hover={suppressHover?"true":"false"}
      onPointerLeave={()=>{if(!expanded&&!draggingId)setSuppressHover(false);}}
      aria-label={zh?"财务工具侧边抽屉":"Finance tools side drawer"}>
      <button type="button" className="mh-insights-dock__toggle" aria-expanded={expanded}
        aria-label={expanded?(zh?"收起工具抽屉":"Collapse tools drawer"):(zh?"展开工具抽屉":"Expand tools drawer")}
        onClick={e=>{setExpanded(p=>!p);setSuppressHover(expanded);if(expanded)e.currentTarget.blur();}}>
        <span aria-hidden="true">{expanded?"‹":"›"}</span>
      </button>
      <div ref={itemsRef} className="mh-insights-dock__items"
        onClickCapture={e=>{if(suppressClickRef.current){e.preventDefault();e.stopPropagation();suppressClickRef.current=false;}}}>
        {order.map(id=>{
          const slot=slots.find(item=>item.id===id);
          if(!slot)return null;
          return <div key={id} data-dock-id={id} className={"mh-insights-dock__sortable"+(draggingId===id?" is-dragging":"")}
            onPointerDown={e=>beginLongPress(e,id)}
            onContextMenu={e=>{if(pointerRef.current?.id===id)e.preventDefault();}}>
            {slot.node}
          </div>;
        })}
      </div>
      <p className="mh-insights-dock__hint">{zh?"长按按钮拖动排序":"Hold & drag to reorder"}</p>
    </nav>
    {dragging&&<div className="mh-insights-dock__ghost" role="status"
      style={{left:(dockRef.current?.getBoundingClientRect().left||0)+12,top:(ghostY||0)-26}}>
      <span>{dragging.label}</span><span aria-hidden="true">{dragging.icon}</span>
    </div>}
  </>;
}
