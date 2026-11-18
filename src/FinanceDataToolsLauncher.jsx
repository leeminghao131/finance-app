import React,{useState} from "react";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";

/** One launcher that becomes two choices on mouse hover, tap, or keyboard activation. */
export default function FinanceDataToolsLauncher({onOpen=()=>{},disabled=false}){
  const {language}=useFinanceLanguage(),zh=language==="zh";
  const [open,setOpen]=useState(false);
  const dismissFocus=event=>{
    if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);
  };
  const launch=(kind,event)=>{
    if(disabled)return;
    setOpen(false);
    onOpen(kind,event.currentTarget);
  };
  return <div className={"mh-insights-dock__data-tools"+(open?" is-open":"")}
    onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}
    onBlur={dismissFocus}
    aria-label={zh?"导入与导出工具":"Import and export tools"}>
    <button type="button" disabled={disabled} className="mh-insights-dock__button mh-insights-dock__data-primary"
      aria-expanded={open} aria-haspopup="true"
      aria-label={zh?"展开导入／导出选项":"Open import and export options"}
      onClick={()=>setOpen(true)}>
      <span className="mh-insights-dock__label">{zh?"导入／导出":"Import / Export"}</span>
      <span className="mh-insights-dock__icon" aria-hidden="true">⇅</span>
    </button>
    <div className="mh-insights-dock__data-split" aria-label={zh?"导入和导出":"Import and export"}>
      <button type="button" className="mh-insights-dock__data-action"
        aria-label={zh?"导入 CSV":"Import CSV"} title={zh?"导入 CSV":"Import CSV"}
        disabled={disabled} tabIndex={open?0:-1}
        onClick={event=>launch("import",event)}>
        <span aria-hidden="true">⬆</span><span>CSV</span>
      </button>
      <button type="button" className="mh-insights-dock__data-action"
        aria-label={zh?"导出 Excel":"Export Excel"} title={zh?"导出 Excel":"Export Excel"}
        disabled={disabled} tabIndex={open?0:-1}
        onClick={event=>launch("export",event)}>
        <span aria-hidden="true">⬇</span><span>Excel</span>
      </button>
    </div>
  </div>;
}
