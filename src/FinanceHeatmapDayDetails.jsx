import React from "react";
import FinanceOverlay from "./FinanceOverlay.jsx";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";
import {builtInFinanceCategory} from "./financeLanguage.js";
import {financeCalendarDaySummary} from "./financeCalendarEvents.js";

const rm = value => "RM " + Number(value||0).toLocaleString("en-MY",{
  minimumFractionDigits:2,maximumFractionDigits:2
});
const rowsForDate=(records,date)=>(Array.isArray(records)?records:[])
  .filter(row=>row?.date===date&&(row.type==="income"||row.type==="expense")&&!row.deleted_at);

// Display-only drill-down. All records are already loaded and validated by App.
// The heatmap intensity is filtered, but its day details show the entire date.
export default function FinanceHeatmapDayDetails({
  open,date,records=[],events=[],asOfDate="",heatmapSpending=0,scopeLabel="",triggerRef,onClose
}){
  const {language}=useFinanceLanguage();
  const zh=language==="zh";
  const rows=date&&date<=asOfDate?rowsForDate(records,date):[];
  const calendar=date?financeCalendarDaySummary(events,date):null;
  const cashMovements=(calendar?.events||[]).filter(e=>!e.planned&&["claim-out","claim-in","transfer"].includes(e.kind));
  const scheduled=(calendar?.events||[]).filter(e=>e.planned);
  const t=(cn,en)=>zh?cn:en;
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
    <div className="mh-heat-detail" aria-label="Heatmap daily income and expense details" title={zh ? "日期明细是当天完整的真实收支；热力图格子仍采用当前筛选。转账与预计收入不计入真实收支。" : "Daily details include all actual income and expenses; the heatmap cell follows filters. Transfers and planned income are excluded."}>
      <div className="mh-heat-detail__summary">
        <div><small>{zh?"真实收入":"Actual income"}</small><strong className="is-income">{rm(dailyIncome)}</strong></div>
        <div><small>{zh?"真实支出":"Actual expense"}</small><strong className="is-expense">{rm(dailyExpense)}</strong></div>
        <div><small>{zh?"当天净收支":"Daily net"}</small><strong>{rm(dailyIncome-dailyExpense)}</strong></div>
        <div><small>{t("实际现金净变化","Actual cash movement")}</small>
          <strong className={(calendar?.cashSen||0)>=0?"is-income":"is-expense"}>{rm((calendar?.cashSen||0)/100)}</strong></div>
      </div>
      <div className="mh-heat-detail__columns">
        {details(expenses,"expense")}
        {details(incomes,"income")}
      </div>
      <div className="mh-calendar-detail__extras">
        <section className="mh-heat-detail__section" aria-label={t("当天其他现金流","Other daily cash movements")}>
          <header><h3>{t("资金移动 · Claim / Transfer","Cash movements · Claim / Transfer")}</h3><strong>{cashMovements.length}</strong></header>
          {cashMovements.length?<div className="mh-heat-detail__records">
            {cashMovements.map(item=><article key={item.id} className="mh-heat-detail__record">
              <div className="mh-heat-detail__record-head">
                <strong>{item.kind==="transfer"?t("账户间转账","Account transfer"):item.kind==="claim-out"?t("垫付款","Claim advance"):t("报销到账","Claim reimbursement")}</strong>
                <b className={item.kind==="claim-out"?"is-cash-out":"is-cash-in"}>
                  {item.kind==="transfer"?"⇄ ":item.cashSen<0?"− ":"+ "}{rm(item.amountSen/100)}</b>
              </div>
              <p className="mh-heat-detail__meta">
                <span data-i18n-ignore>{item.title}</span>{item.method?" · "+item.method:""}
              </p>
            </article>)}
          </div>:<p className="mh-heat-detail__empty">{t("没有其他现金流事件","No additional cash events")}</p>}
        </section>
        <section className="mh-heat-detail__section" aria-label={t("预计和待办事项","Scheduled financial events")}>
          <header><h3>{t("预计／待处理 · 不计入真实余额","Scheduled · Excluded from real balance")}</h3><strong>{scheduled.length}</strong></header>
          {scheduled.length?<div className="mh-heat-detail__records">
            {scheduled.map(item=><article key={item.id} className="mh-heat-detail__record">
              <div className="mh-heat-detail__record-head">
                <strong>{item.kind==="bill"?t("固定账单","Recurring bill"):item.kind==="expected"?t("预计收入","Expected income"):t("未来日期记录","Future-dated record")}</strong>
                <b className="is-scheduled">{rm(item.amountSen/100)}</b>
              </div>
              <p className="mh-heat-detail__meta"><span data-i18n-ignore>{item.title}</span> · {item.status==="overdue"?t("逾期未确认","Unconfirmed overdue"):item.status==="unlinked"?t("付款记录待核对","Payment needs reconciliation"):t("尚未发生／不计入余额","Not counted in actual cash")}</p>
            </article>)}
          </div>:<p className="mh-heat-detail__empty">{t("当天没有预计事项","No scheduled events")}</p>}
        </section>
      </div>
      <p className="mh-heat-detail__hint">{t(
        "热力颜色沿用首页支出筛选；日期明细显示该日的完整真实记录。转账不改变总现金，预计事件不会提前入账。",
        "Heat intensity follows expense filters; daily details use the full verified day. Transfers have zero net cash impact; planned items never post early."
      )}</p>
    </div>
  </FinanceOverlay>;
}
