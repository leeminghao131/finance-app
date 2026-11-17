import React,{useRef,useState} from "react";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";

const CORE=["BANK","TNG","CASH","GRAB PAY"];
const inputClass="min-h-16 rounded-2xl border-2 px-3 text-center text-sm font-bold shadow-sm transition active:scale-[.98] touch-none";
export default function FinanceTransferCorners({methods=[],fromMethod,toMethod,onFrom,onTo,disabled=false}){
  const {language}=useFinanceLanguage(),zh=language==="zh";
  const [selected,setSelected]=useState("");
  const [drag,setDrag]=useState(null);
  const dragRef=useRef(null),suppressClickRef=useRef(false),areaRef=useRef(null);
  const shown=CORE.filter(m=>methods.includes(m));
  const missing=CORE.filter(m=>!shown.includes(m));
  const four=[...shown,...missing].slice(0,4);
  const others=methods.filter(m=>!CORE.includes(m));
  const pick=method=>{
    if(disabled)return;
    if(!selected){setSelected(method);onFrom(method);return;}
    if(selected===method){setSelected("");return;}
    onFrom(selected);onTo(method);setSelected("");
  };
  const pointerDown=(e,method)=>{
    if(disabled||e.button!==0||e.isPrimary===false)return;
    dragRef.current={pointerId:e.pointerId,method,x:e.clientX,y:e.clientY,moved:false};
  };
  const pointerMove=e=>{
    const d=dragRef.current;
    if(!d||d.pointerId!==e.pointerId)return;
    if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<7)return;
    d.moved=true;onFrom(d.method);
    const rect=areaRef.current?.getBoundingClientRect();
    if(rect)setDrag({x:e.clientX-rect.left,y:e.clientY-rect.top,method:d.method});
    if(e.cancelable)e.preventDefault();
  };
  const pointerEnd=e=>{
    const d=dragRef.current;
    if(!d||d.pointerId!==e.pointerId)return;
    if(d.moved){
      suppressClickRef.current=true;
      const node=document.elementFromPoint(e.clientX,e.clientY)?.closest("[data-transfer-method]");
      const dest=node?.dataset.transferMethod;
      if(dest&&dest!==d.method&&methods.includes(dest)){
        onFrom(d.method);onTo(dest);setSelected("");
      }else setSelected(d.method);
      window.setTimeout(()=>{suppressClickRef.current=false;},200);
    }
    dragRef.current=null;setDrag(null);
  };
  const methodButton=(method,extra="")=><button key={method} type="button" data-transfer-method={method}
    disabled={disabled||!methods.includes(method)}
    onPointerDown={e=>pointerDown(e,method)} onPointerMove={pointerMove} onPointerUp={pointerEnd}
    onPointerCancel={pointerEnd}
    onClick={()=>{if(!suppressClickRef.current)pick(method);}}
    aria-pressed={fromMethod===method||toMethod===method}
    aria-label={method+(fromMethod===method?" From":toMethod===method?" To":"")}
    className={inputClass+" "+extra+" "+(selected===method?"border-amber-500 bg-amber-100 ":
      fromMethod===method?"border-blue-500 bg-blue-50 ":
      toMethod===method?"border-teal-500 bg-teal-50 ":"border-slate-300 bg-white ")+" disabled:opacity-40"}>
    <span className="block">{method}</span>
    {fromMethod===method&&<span className="block text-[10px] text-blue-700">{zh?"转出":"FROM"}</span>}
    {toMethod===method&&<span className="block text-[10px] text-teal-700">{zh?"转入":"TO"}</span>}
  </button>;
  return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3" aria-label={zh?"拖线资金转账":"Drag-to-transfer"}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <b>{zh?"四角拖线转账":"Four-corner transfer"}</b>
      <span className="text-xs text-slate-500">{zh?"点击起点→终点，或按住拖线":"Tap source → destination or drag a line"}</span>
    </div>
    <div ref={areaRef} className="relative grid grid-cols-2 gap-x-8 gap-y-12 rounded-xl bg-slate-100 p-2 sm:gap-x-20"
      onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
      {four.map(method=>methodButton(method,"relative z-[1]"))}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="rounded-full border bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow">
          {selected?zh?"选择目标":"Choose target":"⇄"}
        </span>
      </div>
      {drag&&<svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 h-full w-full" style={{overflow:"visible"}}>
        <line x1="50%" y1="50%" x2={drag.x} y2={drag.y} stroke="#d97706" strokeWidth="4" strokeLinecap="round" strokeDasharray="6 4"/>
        <circle cx={drag.x} cy={drag.y} r="7" fill="#d97706"/>
      </svg>}
    </div>
    {others.length>0&&<div className="mt-3">
      <p className="mb-2 text-xs font-semibold text-slate-500">{zh?"自定义付款方式":"Custom methods"}</p>
      <div className="flex gap-2 overflow-x-auto pb-2">{others.map(m=>methodButton(m,"min-w-32 shrink-0"))}</div>
    </div>}
    <p className="mt-2 text-xs text-slate-600">{zh?"已选择":"Selected"}：
      <b>{fromMethod||"—"} → {toMethod||"—"}</b>
      {" · "}{zh?"只移动账户资金，不改变总资产":"Money movement only; total assets stay unchanged"}
    </p>
  </section>;
}
