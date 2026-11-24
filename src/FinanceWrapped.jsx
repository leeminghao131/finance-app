import React,{useEffect,useMemo,useRef,useState} from "react";
import FinanceWrappedSceneDeck from "./FinanceWrappedSceneDeck.jsx";
import FinanceWrappedWheelPager from "./FinanceWrappedWheelPager.jsx";
import "./financeWrappedCinematic.css";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {localDateMY} from "./financeCalendar.js";
import {financeWrapped,money} from "./financeStage1Analytics.js";
import {activitySummary} from "./financeActivity.js";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";

const card="rounded-2xl bg-slate-800/80 p-4 text-slate-100";
function exportStoryImage(wrapped,hidden){
  const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Image export is unavailable on this device.");
  const gradient=ctx.createLinearGradient(0,0,1080,1350);
  gradient.addColorStop(0,"#101827");gradient.addColorStop(1,"#2b2b35");
  ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1350);
  ctx.fillStyle="#e6bc77";ctx.font="bold 42px sans-serif";ctx.fillText("MH FINANCE · WRAPPED",80,150);
  ctx.fillStyle="#ffffff";ctx.font="bold 84px sans-serif";ctx.fillText(wrapped.label,80,300);
  const lines=wrapped.mode==="activity"?[
    ["Activity Spending",money(wrapped.current.expense)],
    ["Daily Average",money(wrapped.activitySummary.average)],
    ["Days",String(wrapped.activitySummary.duration)],
    ["Expenses",String(wrapped.current.count)],
    ["Top Category",wrapped.current.categories[0]?.name||"None"],
  ]:[
    ["Income",money(wrapped.current.income)],
    ["Expense",money(wrapped.current.expense)],
    ["Net",money(wrapped.current.net)],
    ["Records",String(wrapped.current.count)],
    ["Top Expense Category",wrapped.current.categories[0]?.name||"None"],
  ];
  let y=420;
  for(const [name,value] of lines){
    ctx.font="32px sans-serif";ctx.fillStyle="#b6c2d3";ctx.fillText(name,80,y);
    ctx.font="bold 54px sans-serif";ctx.fillStyle="#ffffff";
    const display=hidden&&["Income","Expense","Net","Activity Spending","Daily Average"].includes(name)?"RM ••••":String(value);
    // Long category names do not overflow the saved card.
    ctx.fillText(display.slice(0,26),80,y+62,915);y+=158;
  }
  ctx.fillStyle="#cbd5e1";ctx.font="26px sans-serif";
  ctx.fillText("From recorded transactions only · Finance App",80,1260);
  canvas.toBlob(blob=>{
    if(!blob)return;
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="MH_Finance_Wrapped_"+wrapped.mode+"_"+wrapped.label.replace(/[^0-9A-Za-z-]/g,"_")+".png";
    a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  },"image/png");
}
export default function FinanceWrapped({records=[],monthRows=[],budgetTemplate={},
  activities=[],activityLinks=[],disabled=false,dockButton=false}){
  const {language}=useFinanceLanguage(),zh=language==="zh";
  const current=localDateMY().slice(0,7);
  const [open,setOpen]=useState(false),[mode,setMode]=useState("monthly"),[month,setMonth]=useState(current);
  const [quarterStart,setQuarterStart]=useState(current),[year,setYear]=useState(current.slice(0,4));
  const [selectedActivityId,setSelectedActivityId]=useState("");
  const [hideNotes,setHideNotes]=useState(false);
  const [slide,setSlide]=useState(0),[hideAmounts,setHideAmounts]=useState(false),[error,setError]=useState("");
  const [playing,setPlaying]=useState(false);
  const swipeOrigin=useRef(null);
  const triggerRef=useRef(null);
  const report=useMemo(()=>{
    try{
      if(mode==="activity"){
        const selected=activities.find(a=>a.id===selectedActivityId)||activities[0];
        if(!selected)throw Error("Create an Activity in the left drawer first.");
        const a=activitySummary(selected,records,activityLinks);
        return {value:{mode:"activity",label:selected.title,first:selected.startedOn,
          last:selected.endedOn||localDateMY(),activitySummary:a,
          current:{income:0,expense:a.total,net:-a.total,count:a.count,
            categories:a.categories,methods:a.methods,largest:a.largest,
            notes:a.notes,trend:a.daily},
          budget:a.budget?{available:true,total:a.budget.limit,spent:a.budget.spent,
            remaining:a.budget.remaining,savedMonths:0,templateMonths:0,missingMonths:0}
            :{available:false,total:0,spent:a.total,remaining:null,
              savedMonths:0,templateMonths:0,missingMonths:0},
          changes:{income:0,expense:0,net:0},
          disclaimer:"Activity Wrapped counts only linked, non-deleted Expenses; no Transfers or Expected Income."}};
      }
      return {value:financeWrapped(records,{mode,month,quarterStart,year,monthRows,budgetTemplate})};
    }catch(e){return {error:e.message};}
  },[records,mode,month,quarterStart,year,monthRows,budgetTemplate,activities,activityLinks,selectedActivityId]);
  const w=report.value,cur=w?.current;
  const display=n=>hideAmounts?"RM ••••":money(n);
  const a=w?.activitySummary;
  const activitySlides=a?[
    {title:zh?"这趟活动的故事":"Your activity story",body:<div className="text-center">
      <p className="text-5xl">🎒</p><p data-i18n-ignore className="mt-3 break-words text-2xl font-bold text-amber-200">{w.label}</p>
      <p className="mt-3 text-sm text-slate-300">{w.first} — {w.last}</p>
      <p className="mt-2 text-xs text-slate-400">{zh?"统计只来自已关联的有效支出记录":"Only linked, non-deleted Expenses are counted"}</p>
    </div>},
    {title:zh?"旅行花费总览":"Activity spending",body:<div className="grid gap-3 sm:grid-cols-2">
      <div className={card}><p>{zh?"总花费":"Total spent"}</p><b className="mt-2 block text-2xl">{display(a.total)}</b></div>
      <div className={card}><p>{zh?"支出笔数":"Expenses recorded"}</p><b className="mt-2 block text-2xl">{a.count}</b></div>
      <div className={card+" sm:col-span-2"}><p>{zh?"活动天数":"Activity days"}</p><b className="mt-2 block text-2xl">{a.duration}</b></div>
    </div>},
    {title:zh?"钱都花在哪儿？":"Where did it go?",body:<div className="space-y-2">
      {a.categories.slice(0,6).map((c,i)=><div key={c.name} className="flex justify-between gap-2 rounded-xl bg-white/10 p-3 text-sm">
        <b data-i18n-ignore>{i+1}. {c.name}</b><b>{display(c.value)}</b>
      </div>)}{!a.categories.length&&<p>{zh?"没有支出记录":"No linked expenses"}</p>}
    </div>},
    {title:zh?"用了哪些付款方式？":"Payment methods",body:<div className="space-y-2">
      {a.methods.map(m=><div key={m.name} className="flex justify-between rounded-xl bg-white/10 p-3 text-sm">
        <span data-i18n-ignore>{m.name}</span><b>{display(m.value)}</b></div>)}
      {!a.methods.length&&<p>{zh?"没有消费":"No spending"}</p>}
    </div>},
    {title:zh?"最大几笔消费":"Largest purchases",body:<div className="space-y-2">
      {a.largest.map(r=><div key={r.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-white/10 p-3 text-xs">
        <span data-i18n-ignore>{r.date} · {r.category} · {hideNotes?"••••":r.note}</span>
        <b>{display(r.amount)}</b></div>)}
      {!a.largest.length&&<p>{zh?"没有消费":"No spending"}</p>}
    </div>},
    {title:zh?"这趟旅行常写什么？":"Favorite notes",body:<div className="space-y-2">
      {hideNotes?<p>{zh?"备注已隐藏，适合隐私分享。":"Notes hidden for privacy sharing."}</p>:
        a.notes.map(n=><div key={n.name} className="flex justify-between rounded-xl bg-white/10 p-3 text-sm">
          <span data-i18n-ignore className="break-words">{n.name}</span><b>×{n.count}</b></div>)}
      {!a.notes.length&&<p>{zh?"暂无备注":"No saved notes"}</p>}
    </div>},
    {title:zh?"每天花了多少钱？":"Daily spending timeline",body:<div className="max-h-72 space-y-2 overflow-y-auto">
      {a.daily.map(d=><div key={d.date} className="flex justify-between gap-2 border-b border-white/10 py-2 text-xs">
        <span>{d.date}</span><b>{display(d.expense)}</b></div>)}
      {!a.daily.length&&<p>{zh?"暂无每日数据":"No daily spending"}</p>}
    </div>},
    {title:zh?"活动预算结果":"Activity budget",body:<div className="space-y-3">
      {a.budget?<><div className={card}><p>{zh?"预算":"Budget"}</p><b>{display(a.budget.limit)}</b></div>
        <div className={card}><p>{zh?"已花／剩余":"Spent / Remaining"}</p><b>{display(a.budget.spent)} / {display(a.budget.remaining)}</b></div>
        <p>{zh?"预算使用率":"Budget used"}：{a.budget.percent}%</p></>:
        <p>{zh?"未设置活动预算。":"No budget was set for this Activity."}</p>}
    </div>},
    {title:zh?"平均每天的花费":"Average per day",body:<div className="text-center">
      <p className="mt-6 text-3xl font-bold">{display(a.average)}</p>
      <p className="mt-4 text-sm text-slate-300">{a.duration} {zh?"天的平均花费（包括没有记账的日期）":"calendar days, including days without entries"}</p>
    </div>},
    {title:zh?"活动故事完成！":"Activity Wrapped complete!",body:<div className="text-center">
      <p className="text-5xl">✨</p><p className="mt-4 text-xl font-bold">{a.count} {zh?"笔支出":"Expenses"}</p>
      
    </div>},
  ]:[];
  const slides=cur&&(mode==="activity"?activitySlides:[
    {title:zh?"你的财务故事":"Your finance story",body:<div className="text-center"><p className="text-sm text-slate-300">MH Finance Wrapped</p><p className="mt-4 text-3xl font-bold text-amber-200">{w.label}</p></div>},
    {title:zh?"收支总览":"Income & Expense",body:<div className="grid gap-3 sm:grid-cols-2">
      <div className={card}><p>{zh?"总收入":"Income"}</p><p className="mt-1 text-xl font-bold text-emerald-300">{display(cur.income)}</p></div>
      <div className={card}><p>{zh?"总支出":"Expense"}</p><p className="mt-1 text-xl font-bold text-rose-300">{display(cur.expense)}</p></div>
      <div className={card+" sm:col-span-2"}><p>{zh?"净收支":"Net cash flow"}</p><p className="mt-1 text-xl font-bold">{display(cur.net)}</p></div>
    </div>},
    {title:zh?"最常花钱的分类":"Top spending categories",body:<div className="space-y-3">
      {cur.categories.slice(0,5).map((c,i)=><div key={c.name} className="flex items-center justify-between gap-3 rounded-xl bg-white/10 p-3 text-sm"><span data-i18n-ignore>{i+1}. {c.name}</span><b>{display(c.value)}</b></div>)}
      {!cur.categories.length&&<p>{zh?"没有支出记录":"No recorded expenses"}</p>}
    </div>},
    {title:zh?"付款方式排行榜":"Payment methods",body:<div className="space-y-3">{cur.methods.slice(0,6).map((m,i)=><div key={m.name} className="flex justify-between gap-3 border-b border-white/10 py-2 text-sm"><b data-i18n-ignore>{i+1}. {m.name}</b><b>{display(m.value)}</b></div>)}{!cur.methods.length&&<p>No payment records.</p>}</div>},
    {title:zh?"最大几笔消费":"Largest expenses",body:<div className="space-y-3">{cur.largest.slice(0,5).map((r,i)=><div key={String(r.id||i)} className="flex justify-between gap-2 rounded-xl bg-white/10 p-3 text-sm"><span data-i18n-ignore className="break-words">{r.date} · {r.category} · {r.note}</span><b className="shrink-0">{display(r.amount)}</b></div>)}{!cur.largest.length&&<p>No recorded expenses.</p>}</div>},
    {title:zh?"最常出现的备注":"Most frequent notes",body:<div className="space-y-3">{cur.notes.map((n,i)=><div key={n.name} className="flex justify-between gap-2 rounded-xl bg-white/10 p-3"><span className="break-words" data-i18n-ignore>{n.name}</span><b>×{n.count}</b></div>)}{!cur.notes.length&&<p>No notes recorded.</p>}</div>},
    {title:zh?"记录时间轴":"Activity over time",body:<div className="space-y-2">{cur.trend.slice(-9).map(d=><div key={d.date} className="flex items-center gap-2 text-xs"><span className="w-24 shrink-0">{d.date}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-3 rounded-full bg-rose-400" style={{width:(cur.expense?Math.min(100,d.expense/Math.max(1,...cur.trend.map(x=>x.expense))*100):0)+"%"}}/></div><span className="w-24 text-right">{display(d.expense)}</span></div>)}{!cur.trend.length&&<p>No daily records.</p>}</div>},
    {title:zh?"预算表现":"Budget performance",body:<div className="space-y-3">
      {w.budget.available?<>
        <div className="flex justify-between rounded-xl bg-white/10 p-3"><span>{zh?"预算总额":"Budget total"}</span><b>{display(w.budget.total)}</b></div>
        <div className="flex justify-between rounded-xl bg-white/10 p-3"><span>{zh?"有预算分类的已花金额":"Budgeted category spending"}</span><b>{display(w.budget.spent)}</b></div>
        <div className="flex justify-between rounded-xl bg-white/10 p-3"><span>{zh?"预算剩余":"Budget remaining"}</span><b>{display(w.budget.remaining)}</b></div>
        <p className="text-xs text-slate-300">{w.budget.savedMonths} {zh?"个月已保存预算":"months with saved snapshots"} · {w.budget.templateMonths} {zh?"个月采用未保存的默认模板":"months using unsaved proposed templates"}</p>
      </>:<p>{zh?"所选期间没有可用预算快照。":"No saved budget snapshots are available for this period."}</p>}
      {w.budget.missingMonths>0&&<p className="rounded-xl bg-amber-900/30 p-3 text-sm text-amber-100">
        {w.budget.missingMonths} {zh?"个月缺少历史预算，因此不能将上方合计当作整个期间的完整预算。":"months have no historical budget snapshot; totals above are incomplete."}
      </p>}
      <p className="text-xs text-slate-300">{zh?"预算额度不等于实际现金。":"Budget allocation is not actual cash."}</p>
    </div>},
    {title:zh?"与上一期间相比":"Compared with prior period",body:<div className="space-y-3">{[["Income",w.changes.income],["Expense",w.changes.expense],["Net",w.changes.net]].map(([name,change])=><div key={name} className="flex justify-between gap-3 rounded-xl bg-white/10 p-3"><span>{name}</span><b>{hideAmounts?"RM ••••":(change>0?"+":"")+money(change)}</b></div>)}<p className="text-xs text-slate-400">Compared with the immediately preceding period of equal length.</p></div>},
    {title:zh?"下一个目标":"Your next chapter",body:<div className="text-center"><p className="text-3xl">✨</p><p className="mt-4 text-xl font-bold">{cur.count} {zh?"笔收支记录":"recorded transactions"}</p></div>},
  ]);
  // All playback and navigation state belongs solely to this display component.
  // No saving, chart calculations, or database service is involved.
  useEffect(()=>{
    if(!open||!playing||report.error||slide>=slides.length-1)return undefined;
    const timer=window.setTimeout(()=>setSlide(index=>Math.min(index+1,slides.length-1)),7600);
    return ()=>window.clearTimeout(timer);
  },[open,playing,report.error,slide,slides.length]);
  useEffect(()=>{
    if(playing&&slide>=slides.length-1)setPlaying(false);
  },[playing,slide,slides.length]);
  useEffect(()=>{
    if(!open||report.error)return undefined;
    const onKey=event=>{
      if(event.altKey||event.ctrlKey||event.metaKey||["INPUT","SELECT","TEXTAREA"].includes(event.target?.tagName))return;
      if(event.key==="ArrowRight"||event.key==="ArrowLeft"){
        event.preventDefault();setPlaying(false);
        setSlide(index=>Math.max(0,Math.min(slides.length-1,index+(event.key==="ArrowRight"?1:-1))));
      }
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[open,report.error,slides.length]);
  return <>
    <button ref={triggerRef} type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setSlide(0);setOpen(true);}}
      className={dockButton
        ? "mh-insights-dock__button"
        : "mh-modal-trigger rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-50"}>
      <span className={dockButton?"mh-insights-dock__label":""}>{zh?"财务回顾":"Finance Wrapped"}</span>
      <span className={dockButton?"mh-insights-dock__icon":""} aria-hidden="true">✨</span>
    </button>
    <FinanceOverlay open={open} onClose={()=>{setPlaying(false);setOpen(false);}}
      title={zh?"财务回顾 · Finance Wrapped":"Finance Wrapped"} triggerRef={triggerRef} widthClass="max-w-5xl">
      <FinanceWrappedWheelPager enabled={!report.error}
        onNavigate={direction=>{
          setPlaying(false);
          setSlide(index=>Math.max(0,Math.min(slides.length-1,index+direction)));
        }}>
        <div className="mh-wrap-controls">
          <div className="mh-wrap-modes" role="group" aria-label={zh?"回顾类型":"Wrapped period"}>
            {[["monthly",zh?"月度":"Monthly"],["quarterly",zh?"自选三个月":"Three Months"],
              ["yearly",zh?"年度":"Yearly"],["activity",zh?"活动／旅行":"Activity / Travel"]]
              .map(([id,name])=><button key={id} type="button" className="mh-wrap-mode"
                aria-pressed={mode===id} onClick={()=>{setMode(id);setSlide(0);setPlaying(false);}}>{name}</button>)}
          </div>
          <div className="mh-wrap-selectors">
            {mode==="monthly"&&<label>{zh?"月份":"Month"}
              <input type="month" value={month} onChange={e=>{setMonth(e.target.value);setSlide(0);setPlaying(false);}}/>
            </label>}
            {mode==="quarterly"&&<label title={zh?"连续三个月的首月":"Start month of three consecutive months"}>
              {zh?"首月":"First month"}
              <input type="month" value={quarterStart} onChange={e=>{setQuarterStart(e.target.value);setSlide(0);setPlaying(false);}}/>
            </label>}
            {mode==="yearly"&&<label>{zh?"年份":"Year"}
              <input type="number" min={1900} max={9998} value={year}
                onChange={e=>{setYear(e.target.value);setSlide(0);setPlaying(false);}}/>
            </label>}
            {mode==="activity"&&<label>{zh?"活动":"Activity"}
              <select value={selectedActivityId||activities[0]?.id||""}
                onChange={e=>{setSelectedActivityId(e.target.value);setSlide(0);setPlaying(false);}}>
                {!activities.length&&<option value="">{zh?"暂无活动":"No activities"}</option>}
                {activities.map(a=><option key={a.id} value={a.id} data-i18n-ignore>{a.title}</option>)}
              </select>
            </label>}
            {mode==="activity"&&<label><input type="checkbox" checked={hideNotes}
              onChange={e=>setHideNotes(e.target.checked)}/>
              {zh?"隐藏私人备注":"Hide private notes"}
            </label>}
            <label><input type="checkbox" checked={hideAmounts}
              onChange={e=>setHideAmounts(e.target.checked)}/>
              {zh?"隐藏 RM 金额":"Hide RM amounts"}
            </label>
          </div>
        </div>
        {report.error?<p role="alert" className="rounded-xl border border-red-600 bg-red-950/50 p-3 text-sm text-red-100">{report.error}</p>:
          <>
            <div className="mh-wrap-shell">
              <div className="mh-wrap-hero">
                <span className="mh-wrap-hero__brand">MH FINANCE · WRAPPED</span>
                <span className="mh-wrap-hero__period" data-i18n-ignore>{w.label}</span>
              </div>
              <div className="mh-wrap-stage"
                onTouchStart={event=>{
                  const point=event.touches[0];
                  if(point)swipeOrigin.current={x:point.clientX,y:point.clientY};
                }}
                onTouchEnd={event=>{
                  const first=swipeOrigin.current,point=event.changedTouches[0];
                  swipeOrigin.current=null;
                  if(!first||!point)return;
                  const dx=point.clientX-first.x,dy=point.clientY-first.y;
                  if(Math.abs(dx)>70&&Math.abs(dy)<45){
                    setPlaying(false);
                    setSlide(index=>Math.max(0,Math.min(slides.length-1,index+(dx<0?1:-1))));
                  }
                }}>
                <FinanceWrappedSceneDeck report={w} mode={mode}
                  chapter={slide} zh={zh} hideNotes={hideNotes} display={display}/>
              </div>
              <div className="mh-wrap-footer">
                <nav className="mh-wrap-progress" aria-label={zh?"回顾章节":"Wrapped chapters"}>
                  {slides.map((item,index)=><button key={index} type="button"
                    className={"mh-wrap-progress__step"+(index===slide?" is-active":index<slide?" is-done":"")}
                    aria-current={index===slide?"step":undefined}
                    aria-label={(zh?"跳到第 ":"Go to chapter ")+(index+1)+(zh?" 章：":": ")+item.title}
                    title={item.title} onClick={()=>{setPlaying(false);setSlide(index);}}/>)}
                </nav>
                <div className="mh-wrap-actions">
                  <button type="button" className="mh-wrap-action" disabled={slide===0}
                    onClick={()=>{setPlaying(false);setSlide(index=>Math.max(0,index-1));}}
                    aria-label={zh?"上一章":"Previous chapter"}>←</button>
                  <button type="button" className="mh-wrap-action"
                    aria-pressed={playing} onClick={()=>{
                      if(slide>=slides.length-1)setSlide(0);
                      setPlaying(value=>!value);
                    }}>
                    {playing?(zh?"Ⅱ 暂停":"Ⅱ Pause"):(zh?"▶ 自动播放":"▶ Auto play")}
                  </button>
                  <button type="button" className="mh-wrap-action mh-wrap-action--primary"
                    onClick={()=>{setPlaying(false);setSlide(index=>index>=slides.length-1?0:index+1);}}>
                    {slide===slides.length-1?(zh?"↻ 重播":"↻ Replay"):(zh?"下一章 →":"Next →")}
                  </button>
                </div>
              </div>
            </div>
            <div className="mh-wrap-below">
              <button type="button" className="mh-wrap-save" onClick={()=>{
                try{exportStoryImage(w,hideAmounts);setError("");}catch(e){setError(e.message);}
              }}>{zh?"⇩ 保存回顾 PNG":"⇩ Save Wrapped PNG"}</button>
              <details className="mh-wrap-details">
                <summary>{zh?"查看原始统计明细":"View detailed statistics"}</summary>
                <div className="mh-wrap-details__body">{slides[slide].body}</div>
              </details>
            </div>
          </>}
        {error&&<p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
        <p className="mh-wrap-disclaimer">{w?.disclaimer||(zh?"仅统计已验证的有效记录。":"Only verified records are included.")}</p>
      </FinanceWrappedWheelPager>
    </FinanceOverlay>
  </>;
}
