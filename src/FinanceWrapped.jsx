import React,{useMemo,useRef,useState} from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {localDateMY} from "./financeCalendar.js";
import {financeWrapped,money} from "./financeStage1Analytics.js";
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
  const lines=[
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
    const display=hidden&&["Income","Expense","Net"].includes(name)?"RM ••••":String(value);
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
export default function FinanceWrapped({records=[],disabled=false}){
  const {language}=useFinanceLanguage(),zh=language==="zh";
  const current=localDateMY().slice(0,7);
  const [open,setOpen]=useState(false),[mode,setMode]=useState("monthly"),[month,setMonth]=useState(current);
  const [quarterStart,setQuarterStart]=useState(current),[year,setYear]=useState(current.slice(0,4));
  const [slide,setSlide]=useState(0),[hideAmounts,setHideAmounts]=useState(false),[error,setError]=useState("");
  const triggerRef=useRef(null);
  const report=useMemo(()=>{
    try{return {value:financeWrapped(records,{mode,month,quarterStart,year})};}
    catch(e){return {error:e.message};}
  },[records,mode,month,quarterStart,year]);
  const w=report.value,cur=w?.current;
  const display=n=>hideAmounts?"RM ••••":money(n);
  const slides=cur&&[
    {title:zh?"你的财务故事":"Your finance story",body:<div className="text-center"><p className="text-sm text-slate-300">MH Finance Wrapped</p><p className="mt-4 text-3xl font-bold text-amber-200">{w.label}</p><p className="mt-4 text-sm">{zh?"从已保存的记录生成":"Made from saved financial records"}</p></div>},
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
    {title:zh?"与上一期间相比":"Compared with prior period",body:<div className="space-y-3">{[["Income",w.changes.income],["Expense",w.changes.expense],["Net",w.changes.net]].map(([name,change])=><div key={name} className="flex justify-between gap-3 rounded-xl bg-white/10 p-3"><span>{name}</span><b>{hideAmounts?"RM ••••":(change>0?"+":"")+money(change)}</b></div>)}<p className="text-xs text-slate-400">Compared with the immediately preceding period of equal length.</p></div>},
    {title:zh?"下一个目标":"Your next chapter",body:<div className="text-center"><p className="text-3xl">✨</p><p className="mt-4 text-xl font-bold">{cur.count} {zh?"笔收支记录":"recorded transactions"}</p><p className="mt-4 text-sm text-slate-300">{zh?"持续记录，让财务故事更清晰。":"Keep tracking to make your next review more meaningful."}</p></div>},
  ];
  return <>
    <button ref={triggerRef} type="button" disabled={disabled} onClick={()=>{setSlide(0);setOpen(true);}}
      className="mh-modal-trigger rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-50">✨ Finance Wrapped</button>
    <FinanceOverlay open={open} onClose={()=>setOpen(false)} title="Finance Wrapped / 财务回顾" triggerRef={triggerRef} widthClass="max-w-4xl">
      <div className="flex flex-wrap gap-2">
        {[["monthly","Monthly"],["quarterly","Custom Quarter"],["yearly","Yearly"]].map(([id,name])=><button key={id}
          type="button" aria-pressed={mode===id} onClick={()=>{setMode(id);setSlide(0);}}
          className={"rounded-xl px-3 py-2 text-sm font-bold "+(mode===id?"bg-slate-900 text-white":"bg-slate-100 text-slate-700")}>{name}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {mode==="monthly"&&<label className="text-sm">Month <input type="month" className="ml-2 rounded-xl border px-3 py-2" value={month} onChange={e=>{setMonth(e.target.value);setSlide(0);}}/></label>}
        {mode==="quarterly"&&<label className="text-sm">First month of any 3 consecutive months <input type="month" className="ml-2 rounded-xl border px-3 py-2" value={quarterStart} onChange={e=>{setQuarterStart(e.target.value);setSlide(0);}}/></label>}
        {mode==="yearly"&&<label className="text-sm">Year <input type="number" min={1900} max={9998} className="ml-2 w-28 rounded-xl border px-3 py-2" value={year} onChange={e=>{setYear(e.target.value);setSlide(0);}}/></label>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hideAmounts} onChange={e=>setHideAmounts(e.target.checked)}/> Hide RM amounts</label>
      </div>
      {report.error?<p role="alert" className="mt-3 text-sm text-red-700">{report.error}</p>:
        <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white sm:p-7">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-amber-200">
            <span>MH FINANCE · {w.label}</span><span>{slide+1} / {slides.length}</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/20"><div className="h-full rounded-full bg-amber-300" style={{width:((slide+1)/slides.length*100)+"%"}}/></div>
          <div className="mt-6 min-h-[310px]">
            <h3 className="mb-5 text-2xl font-bold">{slides[slide].title}</h3>{slides[slide].body}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" disabled={slide===0} onClick={()=>setSlide(n=>n-1)}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold disabled:opacity-40">← Previous</button>
            <button type="button" disabled={slide===slides.length-1} onClick={()=>setSlide(n=>n+1)}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold disabled:opacity-40">Next →</button>
          </div>
        </div>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={!w} onClick={()=>{try{exportStoryImage(w,hideAmounts);setError("");}catch(e){setError(e.message);}}}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Save summary as PNG</button>
        <p className="text-xs text-slate-500">PNG is generated on your device, not uploaded to a server.</p>
      </div>
      {error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <p className="mt-3 text-xs text-slate-500">{w?.disclaimer||"Only verified records are included."} Activity Wrapped will follow in Stage 3.</p>
    </FinanceOverlay>
  </>;
}
