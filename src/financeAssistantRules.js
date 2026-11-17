import {localDateMY,localMonthMY} from "./financeCalendar.js";
import {findReviewCandidates,billOccurrences} from "./financeStage2.js";
import {activitySummary,activeActivity} from "./financeActivity.js";
import {calculateCashForecast,summarizeMonthlyBudget} from "./financeInsights.js";
import {savingsGoalProgress} from "./financePlanning.js";
const sum=(rows,type)=>rows.filter(x=>x.type===type).reduce((n,x)=>n+Math.round(Number(x.amount||0)*100),0)/100;
const money=n=>"RM"+Number(n||0).toFixed(2);
export const ASSISTANT_SUGGESTIONS=[
  ["这个月收入多少？","How much did I earn this month?"],
  ["这个月花了多少？","How much did I spend this month?"],
  ["我还剩多少钱？","What's my ledger balance?"],
  ["哪类消费最多？","What's my top spending category?"],
  ["预算还剩多少？","How much budget remains?"],
  ["有哪些账单到期？","Which bills are due?"],
  ["有多少异常记录？","How many transactions need review?"],
  ["旅行活动花了多少？","What did my activity cost?"],
  ["如何转账？","How do I transfer money?"],
  ["外汇如何记账？","How do I record foreign currency?"],
];
export function answerFinanceQuestion(question,ctx,zh=true){
  const t=(a,b)=>zh?a:b;
  if(!ctx?.ready)return {answer:t("云端完整数据尚未同步，暂时无法计算，请先完成同步。","Full cloud data has not finished syncing. No figures can be verified yet.")};
  const q=String(question||"").trim().toLowerCase();
  if(!q)return {answer:t("请输入财务问题。","Please enter a finance question.")};
  const records=(ctx.records||[]).filter(r=>!r.deleted_at);
  const month=localMonthMY(),monthRecords=records.filter(r=>String(r.date).startsWith(month));
  const expenses=monthRecords.filter(r=>r.type==="expense");
  const income=sum(monthRecords,"income"),spent=sum(monthRecords,"expense");
  if(/外汇|外币|汇率|currency|foreign|exchange/.test(q))
    return {answer:t("在新增交易里选择外币，填写当地金额。系统按交易日期获取 Frankfurter 参考汇率，将换算后的 RM 记入账本，并锁定汇率；它不是银行实际扣款。","Choose a foreign currency in Add Transaction and enter the original amount. A dated Frankfurter reference rate converts it to a locked RM ledger amount; this is not the actual bank debit.")};
  if(/转账|transfer/.test(q))return {answer:t("在 Money Transfer 四角面板先选转出方式，再拖向目标账户或点击目标。确认 RM、日期及备注后按 Transfer Money。账户间移动不改变总资产。","Use the four-corner Money Transfer panel: select a source, drag/tap a destination, verify RM/date/note, then Transfer Money. Your total assets do not change."),action:"transfer"};
  if(/活动|旅游|旅行|activity|travel|trip/.test(q)){
    const a=activeActivity(ctx.activities||[]);
    if(!a)return {answer:t("目前没有进行中的活动，可以在左侧抽屉 Activity Mode 查看历史或新建活动。","No active activity. Open Activity Mode in the drawer to view history or start one.")};
    const s=activitySummary(a,records,ctx.activityLinks||[]);
    return {answer:t("当前活动","Active activity")+" "+a.title+"："+money(s.total)+"，"+s.count+t(" 笔支出。"," Expenses.")};
  }
  if(/异常|疑似|复查|review|anomal|duplicate/.test(q)){
    const n=findReviewCandidates(records,ctx.reviewState||{},localDateMY()).filter(c=>!c.confirmed).length;
    return {answer:t("目前有 ","There are ")+n+t(" 笔待复查异常交易。可从提醒铃铛或 Review Inbox 打开。"," transactions awaiting review. Open Alerts or Review Inbox."),action:"review"};
  }
  if(/到期|账单|bill|due/.test(q)){
    const due=billOccurrences(ctx.bills||[],localDateMY(),records,70,35).filter(x=>x.visible);
    return {answer:t("当前有 ","There are ")+due.length+t(" 个可见的账单提醒。"," due bill reminders.")+(due.length?" "+due.slice(0,3).map(x=>x.title+" "+x.due).join("；"):""),action:"bill"};
  }
  if(/预算|budget/.test(q)){
    try{
      const monthBudget=(ctx.monthRows||[]).find(m=>m.month===month)?.category_budgets||ctx.budgets||{};
      const result=summarizeMonthlyBudget(records,monthBudget,month);
      return {answer:t("本月已设分类预算 ","Monthly planned category budgets ")+money(result.totalBudget)
        +t("；预算内支出 ","; tracked spending ")+money(result.trackedExpense)
        +t("；预算剩余 ","; remaining budget ")+money(result.remaining)
        +t("；未设预算分类支出 ","; unbudgeted spending ")+money(result.unbudgetedExpense)+"。"};
    }catch(e){return {answer:t("预算数据暂无法验证：","Budget could not be verified: ")+e.message};}
  }
  if(/分类|类别|最多|category|top spend|biggest spend/.test(q)){
    const totals={};for(const r of expenses)totals[r.category]=(totals[r.category]||0)+Number(r.amount);
    const top=Object.entries(totals).sort((a,b)=>b[1]-a[1])[0];
    return {answer:top?t("本月最大支出分类：","Top spending category this month: ")+top[0]+" "+money(top[1]):t("本月尚无支出。","No expenses this month.")};
  }
  if(/付款方式|账户|method|tng|bank|cash/.test(q)){
    return {answer:(ctx.methods||[]).map(m=>m.method+" "+money(m.balance)).join("；")||t("暂时没有可用账户余额。","No method balances available."),action:"accounts"};
  }
  if(/余额|还剩|结余|balance|left|remaining/.test(q)){
    return {answer:t("当前完整账本余额为 ","Verified ledger balance: ")+money(ctx.totalBalance)+t("（包括 Opening Balance，不代表银行实际结余）。"," (includes opening balances; not a verified bank balance).")};
  }
  if(/收入|赚|income|earn|salary/.test(q)){
    return {answer:t("本月实际 Income 合计：","Actual income this month: ")+money(income)+t("。Expected Income 不算真实收入。",". Expected Income is excluded.")};
  }
  if(/支出|花了|消费|expense|spend|spent/.test(q)){
    return {answer:t("本月实际 Expense 合计：","Actual expenses this month: ")+money(spent)+t("，共 "," across ")+expenses.length+t(" 笔。"," transactions.")};
  }
  if(/储蓄|目标|saving|goal/.test(q)){
    try{
      const goals=ctx.goals||[];
      if(!goals.length)return {answer:t("目前没有储蓄目标。","No savings goals yet.")};
      const details=goals.slice(0,6).map(goal=>{
        const p=savingsGoalProgress(goal);
        return goal.title+": "+p.percent+"% ("+money(goal.saved)+"/"+money(goal.target)+")";
      });
      return {answer:t("储蓄目标进度（仅计划，不代表真实转账）：","Savings goal progress (plans, not actual transfers): ")+details.join("；")};
    }catch(e){return {answer:t("储蓄目标数据暂无法验证：","Savings goals could not be verified: ")+e.message};}
  }
  if(/预测|月底|forecast|predict/.test(q)){
    try{
      const f=calculateCashForecast(records,{asOfDate:localDateMY(),selectedMonth:localMonthMY(),
        horizon:"monthEnd",trailingDays:30,plannedIncomes:ctx.forecastPlans||[],
        openingBalanceTotal:ctx.openingBalanceTotal||0});
      return {answer:t("沿用 Cash Flow Forecast 的本月底预测：","Month-end estimate from Cash Flow Forecast: ")
        +money(f.predictedBalance)+t("；预计未来支出 ","; forecast expenses ")+money(f.expectedExpense)
        +t("，预计收入 ","; planned income ")+money(f.expectedIncome)
        +t("。只是账本预测，不代表银行实际余额。",". Ledger estimate only, not a verified bank balance.")};
    }catch(e){return {answer:t("预测数据暂无法验证：","Forecast could not be verified: ")+e.message};}
  }
  return {answer:t("我只支持只读财务问题，例如本月收支、余额、最大消费分类、预算、账单、异常记录、活动、转账、外汇及预测入口。","I answer read-only questions about income, expenses, balance, categories, budgets, bills, review, activities, transfers, FX and forecast guidance.")};
}
