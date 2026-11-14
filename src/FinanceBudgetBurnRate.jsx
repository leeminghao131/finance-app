import React,{useMemo,useState} from "react";
import {localDateMY} from "./financeCalendar.js";
import {forecastBudgetBurnRate,money} from "./financeStage1Analytics.js";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";
import {builtInFinanceCategory} from "./financeLanguage.js";

/**
 * UI-only Stage 1.1 refresh. Forecast formulas and month snapshots are unchanged.
 * All mixed dynamic captions are localized explicitly rather than relying on
 * the mutation-based translator for string + RM value combinations.
 */
export default function FinanceBudgetBurnRate({records,budgets,month,categories}){
  const {language}=useFinanceLanguage();
  const zh=language==="zh";
  const t=(cn,en)=>zh?cn:en;
  const [rate,setRate]=useState("month");
  const result=useMemo(()=>{
    try{return {data:forecastBudgetBurnRate(records,budgets,month,localDateMY(),categories)};}
    catch(e){return {error:e.message};}
  },[records,budgets,month,categories]);
  if(result.error)return <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
    {t("预测暂不可用：","Prediction unavailable: ")}{result.error}
  </p>;
  const data=result.data;
  const visible=data.rows.filter(r=>r.hasBudget||r.spent>0)
    .sort((a,b)=>b.spent-a.spent||a.category.localeCompare(b.category));
  const projected=r=>rate==="month"?r.projectedMonth:r.projectedRecent;
  const over=r=>r.hasBudget&&!data.historical&&!data.future&&projected(r)!==null
    ?Math.max(0,Math.round((projected(r)-r.budget)*100)/100):0;
  const atRisk=visible.filter(r=>over(r)>0);
  const riskTotal=Math.round(atRisk.reduce((sum,r)=>sum+Math.round(over(r)*100),0))/100;
  const biggest=atRisk.slice().sort((a,b)=>over(b)-over(a))[0];
  const period=data.historical?t("历史月份 · 实际支出","Past month · actual spending")
    :data.future?t("未来月份 · 尚无消费速度","Future month · spending rate unavailable")
    :t("已过 "+data.elapsed+" / "+data.totalDays+" 天",data.elapsed+" / "+data.totalDays+" days elapsed");
  const detail=data.historical?t("历史月份不做预测","No forecast for a past month")
    :data.future?t("月份开始后才能预测","Forecast begins when the month starts")
    :data.elapsed<3?t("月初数据较少，预测可能波动","Early month: estimate may vary")
    :t("依据已记录支出估算，不代表未来一定如此","Estimate from recorded spending, not a guarantee");
  return <section className="mt-4 rounded-2xl bg-slate-50 p-3 text-slate-900 ring-1 ring-slate-200" aria-label={t("预算消耗速度预测","Budget burn-rate forecast")}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-bold">{t("本月消费速度预测","Monthly spending forecast")}</h3>
        <p className="mt-1 text-xs text-slate-500">{month} · {period}</p>
      </div>
      <div className="inline-flex shrink-0 gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200" aria-label={t("预测方式","Forecast method")}>
        {[["month",t("本月平均","Month average")],["recent",t("最近 7 天","Last 7 days")]].map(([id,label])=>
          <button type="button" key={id} aria-pressed={rate===id} onClick={()=>setRate(id)}
            className={"rounded-lg px-3 py-2 text-xs font-semibold transition-colors "+(rate===id?"bg-slate-900 text-white":"text-slate-700 hover:bg-slate-100")}>{label}</button>)}
      </div>
    </header>
    <div className="mt-3 grid grid-cols-3 gap-2">
      <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
        <p className="text-xs text-slate-500">{t("风险分类","At-risk categories")}</p>
        <p className={"mt-1 text-xl font-bold tabular-nums "+(atRisk.length?"text-red-700":"text-slate-900")}>{data.historical||data.future?"—":atRisk.length}</p>
      </div>
      <div className="min-w-0 rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
        <p className="text-xs text-slate-500">{t("最高风险","Highest risk")}</p>
        <p className="mt-1 truncate text-sm font-semibold" title={biggest?.category||""} data-i18n-ignore>
          {biggest?builtInFinanceCategory(biggest.category,language):t("无","None")}
        </p>
      </div>
      <div className="min-w-0 rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
        <p className="text-xs text-slate-500">{t("预计超支合计","Projected overspend")}</p>
        <p className={"mt-1 break-words text-sm font-bold tabular-nums "+(riskTotal>0?"text-red-700":"text-slate-900")}>
          {data.historical||data.future?"—":money(riskTotal)}
        </p>
      </div>
    </div>
    <p className="mt-3 text-xs text-slate-500">{detail}</p>
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      {visible.map(r=>{
        const value=projected(r),excess=over(r);
        const aboveNow=r.hasBudget&&r.spent>r.budget;
        const status=!r.hasBudget?t("未设预算","No budget")
          :data.historical?t("历史记录","Historical")
          :data.future?t("等待月份开始","Not started")
          :excess>0?t("超预算风险","Overspend risk")
          :t("预计预算内","On track");
        return <article key={r.category} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="break-words text-sm font-bold" data-i18n-ignore>{builtInFinanceCategory(r.category,language)}</h4>
            <span className={"rounded-full px-2.5 py-1 text-xs font-medium "+
              (aboveNow||excess>0?"bg-red-50 text-red-700":"bg-slate-100 text-slate-600")}>{status}</span>
          </div>
          {r.hasBudget&&<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar"
            aria-valuenow={Math.min(100,Math.max(0,r.usage??0))} aria-valuemin={0} aria-valuemax={100}
            aria-label={t("已使用预算比例","Budget usage")}>
            <div className={"h-full rounded-full "+(r.usage>=100?"bg-red-600":r.usage>=75?"bg-amber-500":"bg-teal-600")}
              style={{width:Math.min(100,Math.max(0,r.usage??0))+"%"}}/>
          </div>}
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
            <div><dt className="text-xs text-slate-500">{t("预算","Budget")}</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">{r.hasBudget?money(r.budget):"—"}</dd></div>
            <div><dt className="text-xs text-slate-500">{t("已支出","Spent")}</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">{money(r.spent)}</dd></div>
            <div><dt className="text-xs text-slate-500">{data.historical?t("实际支出","Actual spending"):t("预计月底","Projected month-end")}</dt>
              <dd className="mt-0.5 text-base font-bold tabular-nums">{data.future?"—":money(data.historical?r.spent:value)}</dd></div>
            <div><dt className="text-xs text-slate-500">{data.historical?t("预算剩余","Budget remaining")
              :excess>0?t("可能超支","Possible overspend"):t("剩余每日建议","Daily remaining allowance")}</dt>
              <dd className={"mt-0.5 text-sm font-semibold tabular-nums "+(excess>0?"text-red-700":"text-teal-700")}>
                {data.historical?(r.hasBudget?money(r.remaining):"—")
                  :data.future?"—":excess>0?money(excess)
                  :r.safeDaily!==null?money(r.safeDaily):"—"}</dd></div>
          </dl>
        </article>;
      })}
    </div>
    {!visible.length&&<p className="mt-3 rounded-xl bg-white p-4 text-sm text-slate-600">
      {t("这个月还没有分类预算或有效支出记录。","No category budget or spending records for this month.")}
    </p>}
    <p className="mt-3 text-xs text-slate-500">{t("仅供参考；不会修改已保存的预算或真实交易。","Read-only reference; saved budgets and transactions never change.")}</p>
  </section>;
}
