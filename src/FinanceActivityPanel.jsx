import React,{useMemo,useRef,useState} from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {activitySummary,activityRecords,activeActivity} from "./financeActivity.js";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";

const money=n=>new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"}).format(n);
const input="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm";
const button="min-h-10 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-40";
export default function FinanceActivityPanel({
  activities=[],links=[],records=[],onCreate,onUpdate,onLink,onUnlink,
  disabled=false,dockButton=false,
}){
  const {language}=useFinanceLanguage(),zh=language==="zh",t=(a,b)=>zh?a:b;
  const [open,setOpen]=useState(false),[selectedId,setSelectedId]=useState("");
  const [title,setTitle]=useState(""),[budget,setBudget]=useState("");
  const [editing,setEditing]=useState(false),[draftTitle,setDraftTitle]=useState(""),[draftBudget,setDraftBudget]=useState("");
  const [search,setSearch]=useState(""),[recordId,setRecordId]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  const triggerRef=useRef(null);
  const active=activeActivity(activities);
  const selected=activities.find(a=>a.id===selectedId)||active||activities[0]||null;
  const summary=useMemo(()=>{
    if(!selected)return null;
    try{return activitySummary(selected,records,links);}
    catch(e){return {error:e.message};}
  },[selected,records,links]);
  const eligible=useMemo(()=>{
    const term=search.trim().toLocaleLowerCase();
    return records.filter(r=>r.type==="expense"&&!r.deleted_at &&
      !links.some(l=>l.recordId===String(r.id)&&!l.removedAt) &&
      (!term||[r.date,r.category,r.method,r.note,r.amount].some(v=>String(v||"").toLocaleLowerCase().includes(term))));
  },[records,links,search]);
  const run=async fn=>{
    if(busy||disabled)return;
    setBusy(true);setError("");setSuccess("");
    try{await fn();setSuccess(t("已安全保存到云端。","Saved to cloud."));}
    catch(e){setError(e.message||String(e));}
    finally{setBusy(false);}
  };
  const create=()=>run(async()=>{
    const created=await onCreate({title,budget});
    if(!created)throw Error(t("未确认保存，请刷新云端再重试。","Save not confirmed. Reload cloud first."));
    setTitle("");setBudget("");setSelectedId(created.id);
  });
  const status=next=>run(async()=>{
    if(!selected)return;
    if(next==="finished"&&!window.confirm(t("结束后不会再自动关联新支出。结束的活动保留全部历史。确认结束？",
      "End this Activity? Its history stays, but no future Expenses are automatically linked.")))return;
    if(!await onUpdate(selected,{status:next}))
      throw Error(t("活动状态未保存，请先刷新。","Activity state was not saved. Refresh first."));
  });
  const updateDetails=()=>run(async()=>{
    if(!await onUpdate(selected,{title:draftTitle,budget:draftBudget}))
      throw Error(t("活动修改未保存，请刷新重试。","Activity edits were not saved."));
    setEditing(false);
  });
  const attach=()=>run(async()=>{
    if(!selected||!recordId)throw Error(t("请选择一笔 Expense。","Choose an Expense."));
    if(!await onLink(recordId,selected.id))
      throw Error(t("关联未确认，请刷新记录后重试。","Link not confirmed; refresh first."));
    setRecordId("");
  });
  const detach=link=>run(async()=>{
    if(!window.confirm(t("只移除活动关联，不删除原本的 Expense。确认？",
      "Remove only the Activity tag? The original Expense will remain.")))return;
    if(!await onUnlink(link))throw Error(t("解除关联未确认，请刷新后重试。","Unlink not confirmed; refresh."));
  });
  const linked=selected?activityRecords(records,links,selected.id):[];
  return <>
    <button type="button" disabled={disabled} ref={triggerRef} aria-haspopup="dialog"
      aria-expanded={open} onClick={()=>setOpen(true)}
      className={dockButton?"mh-insights-dock__button":"min-h-10 rounded-xl border px-3 py-2 text-sm font-semibold"}>
      <span className={dockButton?"mh-insights-dock__label":""}>{t("旅行／活动记账","Activity Mode")}{active?" ●":""}</span>
      <span className={dockButton?"mh-insights-dock__icon":""} aria-hidden="true">🎒</span>
    </button>
    <FinanceOverlay open={open} onClose={()=>{if(!busy)setOpen(false);}}
      title={t("旅行／活动记账","Travel & Activity Mode")} triggerRef={triggerRef} widthClass="max-w-5xl">
      <p className="text-xs text-slate-500">{t("开启期间，新保存的 Expense 自动关联活动；Income、Transfer 和预计收入不会计入活动消费。",
        "While an Activity is active, newly saved Expenses are linked. Income, Transfers and expected income are excluded.")}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className="rounded-xl border border-slate-200 p-3">
          <h3 className="font-bold">{t("新建活动","Start an Activity")}</h3>
          <label className="mt-2 block text-xs">{t("活动名称","Name")}
            <input className={"mt-1 "+input} maxLength={90} value={title}
              onChange={e=>setTitle(e.target.value)} placeholder={t("例如：成都旅行","E.g. Chengdu trip")}/>
          </label>
          <label className="mt-2 block text-xs">{t("活动预算（RM，可选）","Budget (RM, optional)")}
            <input className={"mt-1 "+input} inputMode="decimal" value={budget}
              onChange={e=>setBudget(e.target.value)} placeholder="1500.00"/>
          </label>
          <button type="button" onClick={create} disabled={busy||disabled||!!active||!title.trim()}
            className="mt-3 min-h-10 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">
            {t("＋ 开始活动","＋ Start Activity")}
          </button>
          {active&&<p className="mt-2 text-xs text-amber-800">
            {t("目前已有一个进行中的活动。请先暂停或结束它，才能开启另一个活动。",
              "An Activity is currently active. Pause or finish it before starting another.")}
          </p>}
          <h3 className="mt-4 text-sm font-bold">{t("我的活动","My Activities")}</h3>
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {activities.slice().sort((a,b)=>b.startedOn.localeCompare(a.startedOn)).map(a=>
              <button key={a.id} type="button" onClick={()=>{setSelectedId(a.id);setEditing(false);}}
                className={"w-full rounded-lg border px-3 py-2 text-left text-sm "+
                  (selected?.id===a.id?"border-teal-500 bg-teal-50":"border-slate-200")}>
                <span className="block break-words font-semibold" data-i18n-ignore>{a.title}</span>
                <span className="text-xs text-slate-500">{a.startedOn} · {a.status==="active"?t("进行中","Active"):
                  a.status==="paused"?t("已暂停","Paused"):t("已结束","Finished")}</span>
              </button>)}
            {!activities.length&&<p className="text-xs text-slate-500">{t("尚无活动。","No activities yet.")}</p>}
          </div>
        </section>
        <section className="min-w-0 space-y-3">
          {selected&&summary&&!summary.error?<div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="break-words text-base font-bold" data-i18n-ignore>🎒 {selected.title}</h3>
                <p className="text-xs text-slate-500">{selected.startedOn}{selected.endedOn?" — "+selected.endedOn:""} · {selected.status}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selected.status==="active"&&<button disabled={busy} type="button" onClick={()=>status("paused")} className={button}>{t("暂停","Pause")}</button>}
                {selected.status==="paused"&&<button disabled={busy||!!active} type="button" onClick={()=>status("active")} className={button}>{t("继续","Resume")}</button>}
                {selected.status!=="finished"&&<button disabled={busy} type="button" onClick={()=>status("finished")} className={button}>{t("结束","Finish")}</button>}
                <button type="button" disabled={busy} onClick={()=>{
                  setDraftTitle(selected.title);setDraftBudget(selected.budget===null?"":String(selected.budget));
                  setEditing(v=>!v);
                }} className={button}>{t("编辑","Edit")}</button>
              </div>
            </div>
            {editing&&<div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
              <label className="text-xs">{t("名称","Name")}<input value={draftTitle} className={"mt-1 "+input} maxLength={90} onChange={e=>setDraftTitle(e.target.value)}/></label>
              <label className="text-xs">{t("预算 RM","Budget RM")}<input value={draftBudget} className={"mt-1 "+input} onChange={e=>setDraftBudget(e.target.value)}/></label>
              <button type="button" disabled={busy} onClick={updateDetails} className="min-h-10 rounded-xl bg-teal-700 px-3 text-sm font-bold text-white">{t("保存修改","Save Changes")}</button>
            </div>}
            <div className="grid gap-2 sm:grid-cols-3">
              {[[t("总支出","Total spent"),money(summary.total)],
                [t("关联笔数","Expenses"),String(summary.count)],
                [t("日均花费","Daily average"),money(summary.average)]].map(([k,v])=>
                <div key={k} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{k}</p><b className="mt-1 block break-words text-lg">{v}</b></div>)}
            </div>
            {summary.budget&&<div className="rounded-xl bg-slate-50 p-3 text-xs">
              <div className="flex justify-between gap-2"><b>{t("活动预算进度","Budget progress")}</b><b>{summary.budget.percent}%</b></div>
              <div className="mt-2 h-2 rounded-full bg-slate-200"><div className={"h-full rounded-full "+(summary.budget.percent>=100?"bg-red-600":"bg-teal-600")}
                style={{width:Math.min(100,summary.budget.percent)+"%"}}/></div>
              <p className="mt-2">{t("预算","Budget")}：{money(summary.budget.limit)} · {t("剩余","Remaining")}：{money(summary.budget.remaining)}</p>
            </div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-3"><h4 className="text-sm font-bold">{t("消费分类","Categories")}</h4>
                {summary.categories.map(c=><p key={c.name} className="mt-2 flex justify-between gap-2 text-xs"><span data-i18n-ignore>{c.name}</span><b>{money(c.value)}</b></p>)}
                {!summary.categories.length&&<p className="text-xs text-slate-500">{t("暂无支出","No expenses")}</p>}
              </div>
              <div className="rounded-xl border p-3"><h4 className="text-sm font-bold">{t("每日支出","Daily spending")}</h4>
                <div className="max-h-36 overflow-auto">
                  {summary.daily.map(d=><p key={d.date} className="mt-2 flex justify-between gap-2 text-xs"><span>{d.date}</span><b>{money(d.expense)}</b></p>)}
                  {!summary.daily.length&&<p className="text-xs text-slate-500">{t("暂无支出","No expenses")}</p>}
                </div>
              </div>
            </div>
            <details className="rounded-xl border p-3">
              <summary className="cursor-pointer text-sm font-bold">{t("活动支出记录","Activity Expenses")} ({linked.length})</summary>
              <div className="mt-3 max-h-52 space-y-1 overflow-y-auto">
                {linked.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>{
                  const l=links.find(x=>x.recordId===String(r.id)&&!x.removedAt);
                  return <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                    <span className="min-w-0 break-words">{r.date} · <span data-i18n-ignore>{r.category} / {r.note}</span> · <b>{money(r.amount)}</b></span>
                    {l&&<button disabled={busy} type="button" onClick={()=>detach(l)} className={button}>{t("取消关联","Unlink")}</button>}
                  </div>;
                })}
              </div>
            </details>
            <div className="rounded-xl border p-3">
              <h4 className="text-sm font-bold">{t("手动关联历史 Expense","Link a Past Expense")}</h4>
              <p className="mt-1 text-xs text-slate-500">{t("只增加活动标签，不修改交易金额、日期或原本的备注。",
                "Adds only an Activity association. Amount, date and Note stay unchanged.")}</p>
              <input className={"mt-2 "+input} placeholder={t("搜索日期、分类、备注或金额","Search date, category, note or RM")}
                value={search} onChange={e=>setSearch(e.target.value)}/>
              <select className={"mt-2 "+input} value={recordId} onChange={e=>setRecordId(e.target.value)}>
                <option value="">{t("选择尚未关联的 Expense","Choose an unlinked Expense")} ({eligible.length})</option>
                {eligible.slice(0,120).map(r=><option key={r.id} value={String(r.id)}>
                  {r.date} · {r.category} · {money(r.amount)} · {String(r.note||"").slice(0,24)}
                </option>)}
              </select>
              {eligible.length>120&&<p className="mt-1 text-xs text-slate-500">{t("结果过多，请使用搜索定位记录。","Too many results; use search to locate a record.")}</p>}
              <button disabled={busy||disabled||!recordId} type="button" onClick={attach} className="mt-2 min-h-10 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{t("关联所选 Expense","Link Expense")}</button>
            </div>
          </div>:<div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            {summary?.error||t("请选择或创建一个活动。","Choose or create an Activity.")}
          </div>}
        </section>
      </div>
      {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success&&<p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    </FinanceOverlay>
  </>;
}
