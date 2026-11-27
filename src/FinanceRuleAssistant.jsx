import React,{useEffect,useRef,useState} from "react";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";
import {answerFinanceQuestion,ASSISTANT_SUGGESTIONS} from "./financeAssistantRules.js";
import FinanceAssistantEmblem from "./FinanceAssistantEmblem.jsx";

/** Stage 4 guided FAQ: preset buttons only, never accepts arbitrary typed questions. */
export default function FinanceRuleAssistant({ctx,userId,onOpenTool=()=>{}}){
  const {language}=useFinanceLanguage(),zh=language==="zh";
  const [open,setOpen]=useState(false),[history,setHistory]=useState([]);
  const trigger=useRef(null),messages=useRef(null);
  const hoverCloseTimerRef=useRef(null);
  const clearHoverClose=()=>{
    if(hoverCloseTimerRef.current!==null){
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current=null;
    }
  };
  const desktopHover=event=>event.pointerType==="mouse" &&
    window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches;
  const handleHoverOpen=event=>{
    if(!desktopHover(event))return;
    clearHoverClose();
    setOpen(true);
  };
  const handleHoverLeave=event=>{
    if(!desktopHover(event))return;
    clearHoverClose();
    // Allow pointer to cross the 9px visual gap to the floating sheet.
    hoverCloseTimerRef.current=window.setTimeout(()=>{
      hoverCloseTimerRef.current=null;
      setOpen(false);
    },150);
  };
  useEffect(()=>()=>{if(hoverCloseTimerRef.current!==null)window.clearTimeout(hoverCloseTimerRef.current);},[]);
  useEffect(()=>{setHistory([]);setOpen(false);},[userId]);
  useEffect(()=>{
    if(open)messages.current?.scrollTo({top:messages.current.scrollHeight});
  },[history,open]);
  const ask=question=>{
    const reply=answerFinanceQuestion(question,ctx,zh);
    setHistory(rows=>[...rows.slice(-11),{question,reply}]);
  };
  return <div className="mh-rule-assistant" onPointerLeave={handleHoverLeave}>
    <button ref={trigger} className="mh-rule-assistant__launcher" type="button"
      aria-haspopup="dialog" aria-expanded={open} onPointerEnter={handleHoverOpen}
      onClick={event=>{
        clearHoverClose();
        if(event.nativeEvent?.pointerType==="touch" ||
          !window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches)
          setOpen(value=>!value);
        else setOpen(true);
      }}
      aria-label={zh?"财务小助手":"Finance assistant"} title={zh?"财务小助手":"Finance assistant"}>
      <FinanceAssistantEmblem />
    </button>
    {open&&<section role="dialog" aria-modal="false"
      onPointerEnter={event=>{if(desktopHover(event))clearHoverClose();}}
      onPointerLeave={handleHoverLeave}
      aria-label={zh?"规则式财务助手":"Rule-based finance assistant"}
      className="mh-rule-assistant__sheet">
      <header className="flex items-center justify-between gap-3 rounded-t-xl bg-slate-900 p-3 text-white">
        <div className="flex min-w-0 items-center gap-2"><FinanceAssistantEmblem compact /><h2 className="font-bold">{zh?"财务小助手":"Finance Assistant"}</h2></div>
        <button type="button" className="min-h-10 rounded-lg border border-slate-600 px-3"
          onClick={()=>{clearHoverClose();setOpen(false);}} aria-label={zh?"关闭助手":"Close assistant"}>✕</button>
      </header>
      <div ref={messages} className="max-h-[34dvh] min-h-24 space-y-3 overflow-y-auto p-3" aria-live="polite">

        {history.map((entry,index)=><div key={index} className="space-y-1 text-sm">
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-slate-800">{entry.question}</p>
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-blue-900">{entry.reply.answer}</p>
          {entry.reply.action&&<button type="button"
            aria-haspopup={entry.reply.action==="transfer"?undefined:"dialog"}
            className="min-h-10 rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-700"
            onClick={()=>{
              if(entry.reply.action==="transfer"){
                document.getElementById("mh-money-transfer-card")?.scrollIntoView({behavior:"smooth",block:"center"});
              }else onOpenTool(entry.reply.action,trigger.current);
              setOpen(false);
            }}>
            {zh?"打开对应功能":"Open tool"}
          </button>}
        </div>)}
      </div>
      <div className="mh-rule-assistant__question-area">
        
        <div role="group" aria-label={zh?"预设财务问题":"Preset finance questions"}
          className="mh-rule-assistant__questions">
          {ASSISTANT_SUGGESTIONS.map(([cn,en],index)=>{
            const text=zh?cn:en;
            return <button type="button" key={cn} title={text}
              onClick={()=>ask(text)} className="mh-rule-assistant__question">
              <span aria-hidden="true" className="mh-rule-assistant__question-index">{String(index+1).padStart(2,"0")}</span>
              <span>{text}</span>
            </button>;
          })}
        </div>
      </div>
    </section>}
  </div>;
}
