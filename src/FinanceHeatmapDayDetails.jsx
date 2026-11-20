import React from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";
import {builtInFinanceCategory} from "./financeLanguage.js";

const rm = value => "RM " + Number(value||0).toLocaleString("en-MY",{
  minimumFractionDigits:2,maximumFractionDigits:2
});
const rowsForDate=(records,date)=>(Array.isArray(records)?records:[])
  .filter(row=>row?.date===date&&(row.type==="income"||row.type==="expense")&&!row.deleted_at);

// Display-only drill-down. All records are already loaded and validated by App.
// The heatmap intensity is filtered, but its day details show the entire date.
export default function FinanceHeatmapDayDetails({
  open,date,records=[],heatmapSpending=0,scopeLabel="",triggerRef,onClose
}){
  const {language}=useFinanceLanguage();
  const zh=language==="zh";
  const rows=date?rowsForDate(records,date):[];
  const incomes=rows.filter(row=>row.type==="income");
  const expenses=rows.filter(row=>row.type==="expense");
  const sum=group=>group.reduce((total,row)=>total+Number(row.amount||0),0);
  const dailyIncome=sum(incomes),dailyExpense=sum(expenses);

  function details(group,kind){
    const income=kind==="income";
    return <section aria-label={income?"Daily income records":"Daily expense records"}
      className={"mh-heat-detail__section "+(income?"is-income":"is-expense")}>
      <header>
        <h3>{income?(zh?"收入明细":"Income details"):(zh?"支出明细":"Expense details")}</h3>
        <strong>{rm(income?dailyIncome:dailyExpense)} <small>· {group.length}</small></strong>
      </header>
      {group.length ? <div className="mh-heat-detail__records">
        {group.map((row,index)=><article key={row.id ?? kind+"-"+index} className="mh-heat-detail__record">
          <div className="mh-heat-detail__record-head">
            <strong>{builtInFinanceCategory(row.category,language)}</strong>
            <b>{(income?"+ ":"− ")+rm(row.amount)}</b>
          </div>
          <p className="mh-heat-detail__meta">
            <span data-i18n-ignore>{row.method||"—"}</span>
            {row.note?<> · <span data-i18n-ignore>{row.note}</span></>:null}
          </p>
        </article>)}
      </div> : <p className="mh-heat-detail__empty">
        {income?(zh?"当天没有收入记录":"No income recorded on this date"):
                 (zh?"当天没有支出记录":"No expense recorded on this date")}
      </p>}
    </section>;
  }

  return <FinanceOverlay open={open}
    title={(zh?"每日收支明细":"Daily Income & Expense")+" · "+(date||"")}
    onClose={onClose} triggerRef={triggerRef} widthClass="max-w-3xl">
    <div className="mh-heat-detail" aria-label="Heatmap daily income and expense details">
      <div className="mh-heat-detail__summary">
        <div><small>{zh?"真实收入":"Actual income"}</small><strong className="is-income">{rm(dailyIncome)}</strong></div>
        <div><small>{zh?"真实支出":"Actual expense"}</small><strong className="is-expense">{rm(dailyExpense)}</strong></div>
        <div><small>{zh?"当天净收支":"Daily net"}</small><strong>{rm(dailyIncome-dailyExpense)}</strong></div>
      </div>
      <p className="mh-heat-detail__hint">
        {zh?
          "明细显示所选日期的全部真实收入与支出。热力图方格的金额仍按页面分类及关键词筛选计算。转账及预计收入不属于真实收支。":
          "Details show all actual income and expenses for the selected date. The heatmap cell still follows the current category and keyword filters. Transfers and expected income are not real income or expenses."}
      </p>
      <div className="mh-heat-detail__columns">
        {details(expenses,"expense")}
        {details(incomes,"income")}
      </div>
    </div>
  </FinanceOverlay>;
}
