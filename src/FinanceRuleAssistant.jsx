import React,{useEffect,useRef,useState} from "react";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";
import {answerFinanceQuestion,ASSISTANT_SUGGESTIONS} from "./financeAssistantRules.js";
export default function FinanceRuleAssistant({ctx,userId,onOpenTool=()=>{}}){
  const {language}=useFinanceLanguage(),zh=language==="zh";
  const [open,setOpen]=useState(false),[question,setQuestion]=useState(""),[history,setHistory]=useState([]);
  const trigger=useRef(null),messages=useRef(null);
  useEffect(()=>{setHistory([]);setQuestion("");setOpen(false);},[userId]);
  useEffect(()=>{if(open)messages.current?.scrollTo({top:messages.current.scrollHeight});},[history,open]);
  const ask=q=>{
    const typed=String(q||"").trim().slice(0,400);if(!typed)return;
    const reply=answerFinanceQuestion(typed,ctx,zh);
    setHistory(h=>[...h.slice(-11),{question:typed,reply}]);setQuestion("");
  };
  return <div className="mh-rule-assistant">
    <button ref={trigger} className="mh-rule-assistant__launcher" type="button"
      aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(p=>!p)} aria-label={zh?"财务小助手":"Finance assistant"}>
      <span aria-hidden="true">🤖</span> {zh?"财务助手":"Assistant"}
    </button>
    {open&&<section role="dialog" aria-modal="false" aria-label={zh?"规则式财务助手":"Rule-based finance assistant"}
      className="mh-rule-assistant__sheet">
      <header className="flex items-center justify-between gap-3 rounded-t-xl bg-slate-900 p-3 text-white">
        <div><h2 className="font-bold">🤖 {zh?"财务小助手":"Finance Assistant"}</h2>
          <p className="text-[11px] text-slate-300">{zh?"本地规则回答 · 不使用付费 AI":"Local rules · no paid AI"}</p></div>
        <button type="button" className="min-h-10 rounded-lg border border-slate-600 px-3" onClick={()=>setOpen(false)}
          aria-label={zh?"关闭助手":"Close assistant"}>✕</button>
      </header>
      <div ref={messages} className="max-h-[45dvh] min-h-40 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {!history.length&&<p className="text-sm text-slate-600">{zh?"你可以问我收支、余额、预算、活动或外汇记账问题。":"Ask about your income, expenses, balance, budget, activities or FX."}</p>}
        {history.map((m,i)=><div key={i} className="space-y-1 text-sm">
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-slate-800">{m.question}</p>
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-blue-900">{m.reply.answer}</p>
          {m.reply.action&&<button className="min-h-10 rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-700"
            onClick={()=>{if(m.reply.action==="transfer"){document.getElementById("mh-money-transfer-card")?.scrollIntoView({behavior:"smooth"});setOpen(false);}
              else{onOpenTool(m.reply.action,trigger.current);setOpen(false);}}}>
            {zh?"打开对应功能":"Open tool"}</button>}
        </div>)}
      </div>
      <div className="flex gap-2 overflow-x-auto border-t p-2">
        {ASSISTANT_SUGGESTIONS.map(([cn,en])=><button type="button" key={cn}
          className="min-h-9 shrink-0 rounded-full border px-3 text-xs" onClick={()=>ask(zh?cn:en)}>{zh?cn:en}</button>)}
      </div>
      <form onSubmit={e=>{e.preventDefault();ask(question);}} className="flex gap-2 border-t p-3">
        <input aria-label={zh?"你的财务问题":"Your finance question"} className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
          maxLength={400} value={question} onChange={e=>setQuestion(e.target.value)} placeholder={zh?"输入问题…":"Ask a question…"} />
        <button type="submit" className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">{zh?"发送":"Ask"}</button>
      </form>
      <p className="px-3 pb-2 text-[11px] text-slate-500">{zh?"只读、按当前账号已同步资料计算；不会自动修改或删除交易。":"Read-only answers from synced account data. Never changes or deletes transactions."}</p>
    </section>}
  </div>;
}
