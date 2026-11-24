import React, { useMemo, useState } from "react";

/**
 * Finance Wrapped cinematic display only.
 * All numbers come directly from FinanceWrapped's existing verified report.
 * Buttons change local presentation state; no data writes or network calls.
 */
const COLORS = ["#edc48a", "#80e0d4", "#ef9ba5", "#9db5f8", "#d9b1f2", "#8dc4f2"];
const numberOf = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const percent = (value, whole) => whole > 0 ? clamp(value / whole * 100, 0, 100) : 0;

function StatTile({ label, value, tone = "gold", index = 0 }) {
  return <div className={"mh-wrap-stat mh-wrap-stat--" + tone} style={{ "--tile-order": index }}>
    <span className="mh-wrap-stat__name">{label}</span>
    <strong className="mh-wrap-stat__value">{value}</strong>
    <span aria-hidden="true" className="mh-wrap-stat__trace" />
  </div>;
}

function EmptyStage({ zh, note }) {
  return <div className="mh-wrap-empty">
    <span className="mh-wrap-empty__sigil" aria-hidden="true">◇</span>
    <p>{note || (zh ? "此期间没有可展示的记录" : "No recorded activity for this period")}</p>
  </div>;
}

function OrbitalCrest({ title, value, subtitle, activity }) {
  return <div className="mh-wrap-crest">
    <div className="mh-wrap-crest__orbit mh-wrap-crest__orbit--a" aria-hidden="true" />
    <div className="mh-wrap-crest__orbit mh-wrap-crest__orbit--b" aria-hidden="true" />
    <div className="mh-wrap-crest__orbit mh-wrap-crest__orbit--c" aria-hidden="true" />
    <div className="mh-wrap-crest__core">
      <span className="mh-wrap-crest__glyph" aria-hidden="true">{activity ? "✧" : "✦"}</span>
      <span className="mh-wrap-crest__eyebrow">MH FINANCE</span>
      <strong className="mh-wrap-crest__value" data-i18n-ignore>{value}</strong>
      <span className="mh-wrap-crest__sub">{subtitle}</span>
    </div>
    <div className="mh-wrap-crest__caption"><span>✧</span> {title} <span>✧</span></div>
  </div>;
}

function ComparisonBars({ income, expense, display, zh, activity }) {
  const max = Math.max(income, expense, 1);
  const bars = activity ? [
    { label: zh ? "活动花费" : "Activity spent", value: expense, tone: "rose" },
  ] : [
    { label: zh ? "收入" : "Income", value: income, tone: "jade" },
    { label: zh ? "支出" : "Expense", value: expense, tone: "rose" },
  ];
  return <div className="mh-wrap-flow-bars">
    {bars.map((row, index) => <div className="mh-wrap-flow-bars__row" key={row.label}>
      <div className="mh-wrap-flow-bars__caption"><span>{row.label}</span><strong>{display(row.value)}</strong></div>
      <div className="mh-wrap-flow-bars__track" role="img" aria-label={row.label + ": " + display(row.value)}>
        <span className={"mh-wrap-flow-bars__fill mh-wrap-flow-bars__fill--" + row.tone}
          style={{ width: percent(row.value, max) + "%", "--bar-order": index }} />
      </div>
    </div>)}
  </div>;
}

function CategoryGalaxy({ items, total, display, zh }) {
  const [chosen, setChosen] = useState(0);
  const top = items.slice(0, 5);
  const others = Math.max(0, total - top.reduce((sum, row) => sum + numberOf(row.value), 0));
  const entries = others > 0 ? [...top, { name: zh ? "其他" : "Other", value: others }] : top;
  const sum = entries.reduce((value, item) => value + numberOf(item.value), 0);
  const rings = useMemo(() => {
    const circumference = Math.PI * 2 * 70;
    let offset = 0;
    return entries.map((item, index) => {
      const length = sum > 0 ? numberOf(item.value) / sum * circumference : 0;
      const result = { ...item, index, length, offset, color: COLORS[index % COLORS.length] };
      offset += length;
      return result;
    });
  }, [items, total, zh]);
  if (!entries.length) return <EmptyStage zh={zh}/>;
  const active = rings[Math.min(chosen, rings.length - 1)];
  return <div className="mh-wrap-galaxy">
    <div className="mh-wrap-galaxy__dial">
      <svg viewBox="0 0 220 220" role="img" aria-label={zh ? "支出类别占比图" : "Spending category ratio"}>
        <circle cx="110" cy="110" r="70" stroke="#31475b" strokeWidth="24" fill="none"/>
        {rings.map(row => <circle key={row.name} cx="110" cy="110" r="70"
          className={"mh-wrap-galaxy__arc" + (chosen === row.index ? " is-active" : "")}
          stroke={row.color} strokeWidth="24" fill="none"
          strokeDasharray={Math.max(0, row.length - 1.5) + " " + (Math.PI * 2 * 70)}
          strokeDashoffset={-row.offset}
          transform="rotate(-90 110 110)"
          role="button" tabIndex={0}
          aria-label={row.name + ": " + display(row.value)}
          onClick={() => setChosen(row.index)}
          onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setChosen(row.index); }
          }} />)}
      </svg>
      <div className="mh-wrap-galaxy__center">
        <span data-i18n-ignore className="mh-wrap-galaxy__label">{active.name}</span>
        <strong>{percent(active.value, sum).toFixed(1)}%</strong>
        <small>{display(active.value)}</small>
      </div>
    </div>
    <div className="mh-wrap-galaxy__legend" role="group" aria-label={zh ? "选择支出分类" : "Select spending category"}>
      {rings.map(row => <button type="button" key={row.name} aria-pressed={chosen === row.index}
        className={"mh-wrap-galaxy__item" + (chosen === row.index ? " is-active" : "")}
        onMouseEnter={() => setChosen(row.index)} onClick={() => setChosen(row.index)}>
        <span className="mh-wrap-galaxy__color" style={{ background: row.color }} aria-hidden="true" />
        <span className="mh-wrap-galaxy__name" data-i18n-ignore>{row.name}</span>
        <strong>{percent(row.value, sum).toFixed(0)}%</strong>
      </button>)}
    </div>
  </div>;
}

function PaymentOrbit({ items, display, zh }) {
  const [chosen, setChosen] = useState(0);
  const top = items.slice(0, 6);
  if (!top.length) return <EmptyStage zh={zh}/>;
  const active = top[Math.min(chosen, top.length - 1)];
  return <div className="mh-wrap-payments">
    <div className="mh-wrap-payments__field">
      <div className="mh-wrap-payments__ring mh-wrap-payments__ring--outer" aria-hidden="true"/>
      <div className="mh-wrap-payments__ring mh-wrap-payments__ring--inner" aria-hidden="true"/>
      <div className="mh-wrap-payments__core">
        <span>{zh ? "已选付款方式" : "Selected method"}</span>
        <strong data-i18n-ignore>{active.name}</strong>
        <b>{display(active.value)}</b>
      </div>
      {top.map((row, index) => {
        const radian = -Math.PI / 2 + index * Math.PI * 2 / top.length;
        return <button type="button" key={row.name}
          className={"mh-wrap-payments__satellite" + (chosen === index ? " is-active" : "")}
          style={{ left: (50 + Math.cos(radian) * 40) + "%", top: (50 + Math.sin(radian) * 36) + "%", "--sat-order": index }}
          aria-pressed={chosen === index} onMouseEnter={() => setChosen(index)} onClick={() => setChosen(index)}>
          <span className="mh-wrap-payments__star" aria-hidden="true">✧</span>
          <span data-i18n-ignore>{row.name}</span>
        </button>;
      })}
    </div>
    <p className="mh-wrap-mini-label">{zh ? "点击行星查看对应花费" : "Tap a satellite to inspect its spending"}</p>
  </div>;
}

function Podium({ rows, display, zh, hideNotes }) {
  const [chosen, setChosen] = useState(0);
  const list = rows.slice(0, 5);
  if (!list.length) return <EmptyStage zh={zh}/>;
  const active = list[Math.min(chosen, list.length - 1)];
  return <div className="mh-wrap-podium">
    <div className="mh-wrap-podium__row">
      {list.slice(0, 3).map((row, index) => <button type="button" key={String(row.id || index)}
        className={"mh-wrap-podium__place mh-wrap-podium__place--" + index + (chosen === index ? " is-active" : "")}
        style={{ "--podium-order": index }} onClick={() => setChosen(index)} aria-pressed={chosen === index}>
        <span className="mh-wrap-podium__medal">{["Ⅰ","Ⅱ","Ⅲ"][index]}</span>
        <strong>{display(row.amount)}</strong>
        <span data-i18n-ignore>{row.category}</span>
      </button>)}
    </div>
    <div className="mh-wrap-podium__footer">
      <div>
        <span className="mh-wrap-mini-label">{zh ? "选中的消费" : "Selected expense"}</span>
        <strong>{active.date} · {display(active.amount)}</strong>
        <span data-i18n-ignore>{active.category}{active.note && !hideNotes ? " · " + active.note : ""}</span>
      </div>
      {list.length > 3 && <div className="mh-wrap-podium__extra" role="group" aria-label={zh ? "更多消费" : "More expenses"}>
        {list.slice(3).map((row, index) => <button key={String(row.id || index + 3)} type="button"
          className={chosen === index + 3 ? "is-active" : ""}
          onClick={() => setChosen(index + 3)}>#{index + 4}</button>)}
      </div>}
    </div>
  </div>;
}

function NotesConstellation({ notes, zh, hideNotes }) {
  const [chosen, setChosen] = useState(0);
  const rows = notes.slice(0, 7);
  if (!rows.length) return <EmptyStage zh={zh} note={zh ? "没有常用备注" : "No frequent notes"}/>;
  const active = rows[Math.min(chosen, rows.length - 1)];
  return <div className="mh-wrap-notes">
    <div className="mh-wrap-notes__cloud" role="group" aria-label={zh ? "常用备注" : "Most frequent notes"}>
      {rows.map((item, index) => <button type="button" key={item.name}
        className={"mh-wrap-notes__chip" + (chosen === index ? " is-active" : "")}
        style={{ "--chip-order": index }}
        onClick={() => setChosen(index)} aria-pressed={chosen === index}>
        <span data-i18n-ignore className="mh-wrap-notes__word">{hideNotes ? "••••" : item.name}</span>
        <small>×{item.count}</small>
      </button>)}
    </div>
    <div className="mh-wrap-notes__selection">
      <span>{zh ? "出现次数" : "Times recorded"}</span>
      <strong>×{active.count}</strong>
      <small data-i18n-ignore>{hideNotes ? (zh ? "备注已隐藏" : "Private notes hidden") : active.name}</small>
    </div>
  </div>;
}

function Timeline({ rows, zh, display }) {
  const [chosen, setChosen] = useState(-1);
  const points = rows.slice(-14).map(row => ({
    date: row.date, expense: numberOf(row.expense), income: numberOf(row.income)
  }));
  if (!points.length) return <EmptyStage zh={zh} note={zh ? "本期间没有每日记录" : "No daily records"}/>;
  const max = Math.max(1, ...points.map(row => row.expense));
  const current = points[chosen < 0 || chosen >= points.length ? points.length - 1 : chosen];
  return <div className="mh-wrap-timeline">
    <div className="mh-wrap-timeline__highlight">
      <span>{zh ? "选中日期" : "Selected day"} · {current.date}</span>
      <strong>{display(current.expense)}</strong>
    </div>
    <div className="mh-wrap-timeline__bars" role="group" aria-label={zh ? "逐日支出" : "Daily spending"}>
      {points.map((point, index) => <button type="button" key={point.date}
        className={"mh-wrap-timeline__column" + (current.date === point.date ? " is-active" : "")}
        onClick={() => setChosen(index)} onMouseEnter={() => setChosen(index)} aria-pressed={current.date === point.date}
        title={point.date + " · " + display(point.expense)}>
        <span className="mh-wrap-timeline__rod" style={{
          height: point.expense ? Math.max(7, percent(point.expense, max)) + "%" : "3%",
          "--bar-order": index
        }} />
        <small>{point.date.slice(5)}</small>
      </button>)}
    </div>
    <span className="mh-wrap-mini-label">{zh ? "点击柱状图查看每日金额" : "Select a column to inspect a day"}</span>
  </div>;
}

function BudgetDial({ budget, display, zh }) {
  if (!budget?.available) return <EmptyStage zh={zh} note={zh ? "所选期间没有已保存的预算数据" : "No saved budget snapshot for this period"}/>;
  const raw = budget.usage ?? (budget.total > 0 ? budget.spent / budget.total * 100 : 0);
  const usage = Math.max(0, Number(raw) || 0);
  return <div className="mh-wrap-budget">
    <div className={"mh-wrap-budget__gauge" + (usage >= 100 ? " is-over" : "")}
      style={{ "--budget-progress": clamp(usage, 0, 100) + "%" }}
      role="img" aria-label={(zh ? "预算使用" : "Budget used") + " " + usage.toFixed(1) + "%"}>
      <div className="mh-wrap-budget__gauge-core">
        <span>{zh ? "预算使用率" : "Budget used"}</span>
        <strong>{usage.toFixed(1)}%</strong>
      </div>
    </div>
    <div className="mh-wrap-budget__stats">
      <StatTile label={zh ? "预算总额" : "Allocated budget"} value={display(budget.total)} index={0}/>
      <StatTile label={zh ? "已花预算" : "Tracked spending"} value={display(budget.spent)} tone="rose" index={1}/>
      <StatTile label={zh ? "剩余额度" : "Remaining budget"} value={display(budget.remaining)} tone="jade" index={2}/>
      <div className="mh-wrap-budget__footnotes">
        {(budget.missingMonths > 0) && <p role="note" className="mh-wrap-budget__warning">{budget.missingMonths} {zh ? "个月缺少历史预算，合计不完整" : "months missing budget snapshots; totals are incomplete"}</p>}
        <p>{zh ? "预算额度不是账户现金" : "Budget allocation is not actual cash"}</p>
      </div>
    </div>
  </div>;
}

function Changes({ changes, display, zh }) {
  const rows = [
    { label: zh ? "收入变化" : "Income difference", value: changes.income, tone: "jade" },
    { label: zh ? "支出变化" : "Expense difference", value: changes.expense, tone: "rose" },
    { label: zh ? "净收支变化" : "Net difference", value: changes.net, tone: "gold" }
  ];
  const max = Math.max(1, ...rows.map(row => Math.abs(Number(row.value) || 0)));
  return <div className="mh-wrap-changes">
    {rows.map((row, index) => <div className={"mh-wrap-changes__item mh-wrap-changes__item--" + row.tone} key={row.label}>
      <span>{row.label}</span>
      <strong>{Number(row.value) > 0 && !display(1).includes("••••") ? "+" : ""}{display(row.value)}</strong>
      <div className="mh-wrap-changes__track">
        <span style={{ width: percent(Math.abs(Number(row.value) || 0), max) + "%", "--bar-order": index }} />
      </div>
    </div>)}
    <p className="mh-wrap-mini-label">{zh ? "与上一等长期间相比" : "Compared with the preceding equal-length period"}</p>
  </div>;
}

export default function FinanceWrappedStage({ report, mode, chapter, zh, hideNotes, display }) {
  const current = report.current;
  const activity = mode === "activity";
  const heading = [
    [zh ? "时间之门" : "The Time Gate", zh ? "你的财务故事" : "Your finance story"],
    [zh ? "能量总览" : "Energy Balance", zh ? "期间收支" : "Cash flow"],
    [zh ? "消费星系" : "Spending Galaxy", zh ? "类别分布" : "Category breakdown"],
    [zh ? "支付轨道" : "Payment Orbit", zh ? "付款方式" : "Payment methods"],
    [zh ? "金色排行榜" : "Golden Podium", zh ? "大额消费" : "Largest purchases"],
    [zh ? "备注星云" : "Memory Nebula", zh ? "常用备注" : "Frequent notes"],
    [zh ? "时间之河" : "Time Stream", zh ? "每日轨迹" : "Daily timeline"],
    [zh ? "预算罗盘" : "Budget Compass", zh ? "预算表现" : "Budget performance"],
    [zh ? "变化引擎" : "Change Engine", activity ? (zh ? "每日平均" : "Daily average") : (zh ? "同期比较" : "Prior period")],
    [zh ? "故事终章" : "Final Chapter", zh ? "回顾完成" : "Wrapped complete"],
  ][chapter] || ["MH FINANCE", "WRAPPED"];
  let visual;
  switch (chapter) {
    case 0:
      visual = <OrbitalCrest title={heading[1]} value={report.label}
        subtitle={activity ? (zh ? "一段活动 · " : "One activity · ") + report.activitySummary.duration + (zh ? " 天" : " days") :
          current.count + (zh ? " 笔有效记录" : " valid transactions")} activity={activity}/>;
      break;
    case 1:
      visual = <div className="mh-wrap-cash">
        <div className="mh-wrap-cash__tiles">
          {activity ? <>
            <StatTile label={zh ? "活动总花费" : "Activity spent"} value={display(current.expense)} tone="rose"/>
            <StatTile label={zh ? "支出记录" : "Expenses"} value={current.count} tone="gold" index={1}/>
            <StatTile label={zh ? "活动天数" : "Duration"} value={report.activitySummary.duration} tone="jade" index={2}/>
          </> : <>
            <StatTile label={zh ? "收入" : "Income"} value={display(current.income)} tone="jade"/>
            <StatTile label={zh ? "支出" : "Expense"} value={display(current.expense)} tone="rose" index={1}/>
            <StatTile label={zh ? "净收支" : "Net"} value={display(current.net)} tone="gold" index={2}/>
          </>}
        </div>
        <ComparisonBars income={numberOf(current.income)} expense={numberOf(current.expense)}
          display={display} zh={zh} activity={activity}/>
      </div>;
      break;
    case 2:
      visual = <CategoryGalaxy items={current.categories || []} total={numberOf(current.expense)} display={display} zh={zh}/>;
      break;
    case 3:
      visual = <PaymentOrbit items={current.methods || []} display={display} zh={zh}/>;
      break;
    case 4:
      visual = <Podium rows={current.largest || []} display={display} zh={zh} hideNotes={hideNotes && activity}/>;
      break;
    case 5:
      visual = <NotesConstellation notes={current.notes || []} display={display} zh={zh} hideNotes={hideNotes && activity}/>;
      break;
    case 6:
      visual = <Timeline rows={activity ? (report.activitySummary.daily || []) : (current.trend || [])}
        zh={zh} display={display}/>;
      break;
    case 7:
      visual = <BudgetDial budget={report.budget ? {
        ...report.budget,
        usage: activity ? report.activitySummary.budget?.percent : report.budget.usage
      } : null} zh={zh} display={display}/>;
      break;
    case 8:
      visual = activity ? <div className="mh-wrap-average">
        <OrbitalCrest title={zh ? "按完整活动天数计算" : "Based on full calendar duration"}
          value={display(report.activitySummary.average)}
          subtitle={report.activitySummary.duration + (zh ? " 天" : " days")}
          activity/>
      </div> : <Changes changes={report.changes} display={display} zh={zh}/>;
      break;
    default:
      visual = <OrbitalCrest title={zh ? "这是你的真实记录" : "Your recorded story"}
        value={current.count} subtitle={zh ? "笔有效交易" : "valid transactions"} activity={activity}/>;
  }
  return <section className={"mh-wrap-scene mh-wrap-scene--" + chapter} aria-label={heading[0]}>
    <header className="mh-wrap-scene__heading">
      <span className="mh-wrap-scene__index">{String(chapter + 1).padStart(2, "0")} / 10</span>
      <div>
        <span>{heading[0]}</span>
        <h3>{heading[1]}</h3>
      </div>
      <span className="mh-wrap-scene__seal" aria-hidden="true">✦</span>
    </header>
    <div className="mh-wrap-scene__art" key={chapter}>{visual}</div>
  </section>;
}
