import React,{useMemo,useState} from "react";
import {useFinanceLanguage} from "./FinanceLanguageLayer.jsx";
import {builtInFinanceCategory} from "./financeLanguage.js";
import {discoverSpendingPatterns} from "./financeSpendingPatterns.js";
import "./financeSpendingRadar.css";

const fmt=new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR"});
const labels={
  all:["重点发现","Highlights"],
  category:["分类变化","Category changes"],
  weekday:["星期规律","Weekday habits"],
  frequency:["消费频率","Frequency"],
  large:["大额影响","Large purchases"],
  trend:["长期趋势","Long-term trend"],
  outlier:["异常偏离","Unusual amounts"]
};
const symbol={category:"◈",weekday:"◉",frequency:"▥",large:"✦",trend:"⌁",outlier:"◇"};

export default function FinanceSpendingRadar({records=[],asOfDate,disabled=false}){
  const {language}=useFinanceLanguage(),zh=language==="zh",t=(cn,en)=>zh?cn:en;
  const [kind,setKind]=useState("all");
  const [baselineMonths,setBaselineMonths]=useState(3);
  const [category,setCategory]=useState("all");
  const [expanded,setExpanded]=useState(null);
  const [showAll,setShowAll]=useState(false);
  const result=useMemo(()=>{
    try{return discoverSpendingPatterns(records,{asOfDate,baselineMonths});}
    catch(error){return {status:"error",findings:[],explanation:String(error?.message||error)};}
  },[records,asOfDate,baselineMonths]);
  const availableCategories=useMemo(()=>[...new Set(result.findings.map(x=>x.category)
    .filter(x=>!/^[0-9]+$/.test(x)))].sort((a,b)=>a.localeCompare(b)),
    [result]);
  const matches=result.findings.filter(f=>(kind==="all"||f.kind===kind)
    &&(category==="all"||f.category===category));
  const visible=showAll||kind!=="all"||category!=="all"?matches:matches.slice(0,3);
  const categoryLabel=value=>builtInFinanceCategory(value,language);
  const heading=item=>{
    const label=categoryLabel(item.category);
    const raw=zh?item.titleZh:item.titleEn;
    return raw.startsWith(item.category)?label+raw.slice(item.category.length):raw;
  };
  return <section className="mh-radar-console" aria-label={t("消费规律发现","Spending pattern discovery")}>
    <header className="mh-radar-header">
      <div className="mh-radar-orbit" aria-hidden="true"><span>✧</span></div>
      <div>
        <h2>{t("消费雷达","Spending Radar")}</h2>
        <p>{t("从已保存 Expense 中寻找有依据的消费规律","Explainable patterns from your saved Expenses")}</p>
      </div>
    </header>
    <div className="mh-radar-toolbar">
      <label>{t("对比基准","Comparison baseline")}
        <select value={baselineMonths} disabled={disabled} onChange={e=>{setBaselineMonths(Number(e.target.value));setExpanded(null);setShowAll(false)}}>
          <option value={3}>{t("过去 3 个月同期","Prior 3 comparable months")}</option>
          <option value={6}>{t("过去 6 个月同期","Prior 6 comparable months")}</option>
        </select>
      </label>
      <label>{t("消费分类","Category")}
        <select value={category} disabled={disabled} onChange={e=>{setCategory(e.target.value);setExpanded(null);setShowAll(false)}}>
          <option value="all">{t("全部分类","All categories")}</option>
          {availableCategories.map(name=><option key={name} value={name} data-i18n-ignore>{categoryLabel(name)}</option>)}
        </select>
      </label>
    </div>
    <div className="mh-radar-kinds" role="group" aria-label={t("消费分析类型","Spending analysis type")}>
      {Object.entries(labels).map(([id,caption])=><button type="button" key={id}
        className={kind===id?"is-selected":""} aria-pressed={kind===id}
        disabled={disabled} onClick={()=>{setKind(id);setExpanded(null);setShowAll(false)}}>
        {zh?caption[0]:caption[1]}
      </button>)}
    </div>
    <div className="mh-radar-status" role="status">
      {result.status==="ready"
        ?t("已分析 "+result.analyzed+" 笔历史消费 · 找到 "+matches.length+" 项符合当前筛选的发现",
           "Analyzed "+result.analyzed+" Expenses · "+matches.length+" matching findings")
        :result.status==="insufficient"
          ?t("样本不足：需要近期至少 10 笔 Expense、本月 2 笔及至少 2 个可比较月份。","Insufficient data: at least 10 recent Expenses, 2 this month and 2 comparable months.")
          :t("数据分析未完成："+result.explanation,"Analysis unavailable: "+result.explanation)}
    </div>
    {result.status==="ready"&&visible.length===0&&<p className="mh-radar-empty">
      {t("本次没有达到提醒门槛的规律。这不代表没有消费，也不代表账本不完整。",
        "No patterns met the reporting thresholds. This does not prove there was no spending.")}
    </p>}
    <div className="mh-radar-results">
      {visible.map(item=>{
        const full=expanded===item.id;
        const max=Math.max(1,...item.samples.map(s=>s.value));
        return <article className="mh-radar-finding" key={item.id}>
          <div className="mh-radar-finding__head">
            <span className="mh-radar-symbol" aria-hidden="true">{symbol[item.kind]}</span>
            <div>
              <small>{zh?labels[item.kind][0]:labels[item.kind][1]}</small>
              <h3 data-i18n-ignore={category==="all"?undefined:true}>{heading(item)}</h3>
            </div>
          </div>
          <p className="mh-radar-summary">{zh?item.summaryZh:item.summaryEn}</p>
          <div className="mh-radar-bars" aria-label={t("观察期间的金额或笔数对比","Period comparison chart")}>
            {item.samples.map((sample,index)=><div className="mh-radar-bar" key={item.id+":"+index}>
              <div className="mh-radar-bar__head"><span data-i18n-ignore>{sample.label}</span>
                <strong>{["frequency"].includes(item.kind)?Number(sample.value).toLocaleString("en-MY"):fmt.format(sample.value)}</strong></div>
              <div className="mh-radar-bar__track"><span className={index===item.samples.length-1?"is-current":""}
                style={{width:Math.min(100,Math.max(0,sample.value/max*100))+"%"}}/></div>
            </div>)}
          </div>
          <button type="button" className="mh-radar-evidence-toggle" aria-expanded={full}
            onClick={()=>setExpanded(full?null:item.id)}>
            {t(full?"收起计算依据":"查看计算依据及原始记录",full?"Hide evidence":"Show calculation & evidence")}
            <span aria-hidden="true">{full?"⌃":"⌄"}</span>
          </button>
          {full&&<div className="mh-radar-evidence">
            <p>{zh?item.whyZh:item.whyEn}</p>
            <h4>{t("参与分析的相关交易（最多显示 20 笔）","Related saved Expenses (up to 20)")}</h4>
            {item.evidence.map((row,index)=><div key={String(row.id)+index} className="mh-radar-evidence__row">
              <div>
                <strong>{row.date}</strong><span data-i18n-ignore>{categoryLabel(row.category)}</span>
                {row.note&&<small data-i18n-ignore>{row.note}</small>}
              </div>
              <b>{fmt.format(row.amount)}</b>
            </div>)}
          </div>}
        </article>;
      })}
    </div>
    {result.status==="ready"&&kind==="all"&&category==="all"&&matches.length>3&&
      <button type="button" className="mh-radar-show-all" onClick={()=>{setShowAll(v=>!v);setExpanded(null)}}>
        {t(showAll?"只看前三项":"查看全部 "+matches.length+" 项发现",showAll?"Show top 3 only":"Show all "+matches.length+" findings")}
      </button>}
    <p className="mh-radar-footnote">{t(
      "只分析真实 Expense，不包含 Claim、Transfer、预计收入。资料缺漏或未记账会影响观察结果；所有发现只供参考，不会修改财务资料。",
      "Only actual Expenses are analyzed. Claims, Transfers and expected income are excluded. Missing entries can bias observations. No financial records are changed."
    )}</p>
  </section>;
}
