import React,{useEffect,useRef,useState} from "react";
import {
  chartFields,chartViewport,chartNumber,chartLineRuns,
  chartTickIndices,chartBalanceSegments
} from "./financeChartPlot.js";

const GREEN="#34d399", RED="#fb8285", BLUE="#60a5fa";
const ACTUAL="#e5e7eb", FORECAST="#60a5fa";
const palette = {
  income:GREEN,expense:RED,balanceGreen:GREEN,balanceRed:RED,
  actual:ACTUAL,forecast:FORECAST,
};
const compactRM = value => {
  const n=Number(value)||0;
  if(Math.abs(n)>=1e6)return (n/1e6).toFixed(1)+"m";
  if(Math.abs(n)>=1e3)return (n/1e3).toFixed(1)+"k";
  return Number(n.toFixed(1)).toLocaleString("en-MY");
};
const money = value => "RM " + (Number(value)||0).toLocaleString("en-MY",{
  minimumFractionDigits:2,maximumFractionDigits:2
});
function valueLabel(row,kind){
  const date=row?.dateKey || row?.date || row?.day || "";
  if(kind==="bars")return date+" · Income "+money(row.income)+" · Expense "+money(row.expense);
  if(kind==="expense")return date+" · Expense "+money(row.expense);
  if(kind==="forecast"){
    const actual=chartNumber(row?.actual),future=chartNumber(row?.forecast);
    return date+(actual===null?"":" · Actual ledger "+money(actual))+
      (future===null?"":" · Forecast (not real) "+money(future));
  }
  const value=chartNumber(row?.balanceGreen)??chartNumber(row?.balanceRed);
  return date+(value===null?" · No actual balance":" · Balance "+money(value));
}

// This is a presentation-only SVG plot; App and financeInsights own ALL money
// calculations. Responsive layout never mutates or fills missing financial data.
export default function FinanceNativeChart({
  rows=[],kind="expense",selectedDate="",onSelectDate=null,compact=false,alertLimit=1500,
  label="Financial chart",showPoints=true,hidePointsOnMobile=true,
  maxTicksMobile=4,maxTicksDesktop=7
}){
  const rootRef=useRef(null);
  const [size,setSize]=useState({width:560,height:compact?160:260});
  const [active,setActive]=useState(null);
  useEffect(()=>{
    const element=rootRef.current;
    if(!element)return undefined;
    let frame=0;
    const update=()=>{
      const rect=element.getBoundingClientRect();
      const parent=element.parentElement;
      // Use a safe fallback during initial hidden/zero-size render. ResizeObserver
      // will replace it with the real bounds when this card or popup becomes visible.
      const measuredWidth=rect.width||element.clientWidth||parent?.clientWidth||560;
      const measuredHeight=rect.height||element.clientHeight||parent?.clientHeight||(compact?160:260);
      const width=Math.max(190,Math.round(measuredWidth));
      const height=Math.max(116,Math.round(measuredHeight));
      setSize(prev=>prev.width===width&&prev.height===height?prev:{width,height});
    };
    const schedule=()=>{
      if(frame)cancelAnimationFrame(frame);
      frame=requestAnimationFrame(update);
    };
    update();
    schedule();
    let observer=null;
    if(typeof ResizeObserver!=="undefined"){
      observer=new ResizeObserver(schedule);
      observer.observe(element);
    }
    window.addEventListener("resize",schedule,{passive:true});
    return ()=>{
      if(frame)cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize",schedule);
    };
  },[compact,rows.length]);

  const data=Array.isArray(rows)?rows:[];
  const view=chartViewport(data,kind,size.width,size.height);
  const {width,height,margin,pw,ph,x,y,baseline}=view;
  const fields=chartFields(kind);
  const isMobile=size.width<540 || Boolean(window.matchMedia?.("(pointer: coarse)")?.matches);
  const capacity=Math.max(2,Math.floor(pw/(isMobile?77:83))+1);
  const ticks=new Set(chartTickIndices(data.length,
    Math.min(capacity,isMobile?maxTicksMobile:maxTicksDesktop)));
  const selectedIndex=data.findIndex(row=>row?.dateKey===selectedDate);
  // Bars use centered bins; line plots use first/last at the plot edges.
  const barSlot=pw/Math.max(1,data.length);
  const position=index=>kind==="bars"?margin.left+barSlot*(index+.5):x(index);
  const axisLabel=row=>{
    const raw=String(row?.day||row?.dateKey||row?.date||"");
    return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw.slice(5):raw.slice(0,7);
  };
  const showMarkers=showPoints&&!(hidePointsOnMobile&&isMobile)&&data.length<=45;
  const choose=index=>{
    setActive(index);
    if(typeof onSelectDate==="function"&&data[index])onSelectDate(data[index]);
  };
  const marker=index=>{
    const row=data[index];
    return {
      role:typeof onSelectDate==="function"?"button":"img",
      tabIndex:0,
      "aria-label":valueLabel(row,kind),
      onMouseEnter:()=>choose(index),
      onFocus:()=>choose(index),
      // Android touch scrolling must NOT select every row during touchstart.
      // A completed tap dispatches click; keyboard users still have Enter/Space.
      onClick:()=>choose(index),
      onKeyDown:event=>{
        if(event.key==="Enter"||event.key===" "){
          event.preventDefault();choose(index);
        }
      }
    };
  };
  const selected=active===null?null:data[active];
  if(!data.length)return <div className="mh-native-chart-empty" role="status">
    No data for this period.
  </div>;
  const alertLabel="RM"+Number(alertLimit||1500).toLocaleString("en-MY",{
    maximumFractionDigits:2
  });
  const legend=kind==="bars"?[
      {name:"Income",color:GREEN},{name:"Expense",color:RED}]
    :kind==="expense"?[{name:"Expense",color:BLUE}]
    :kind==="forecast"?[
      {name:"Actual ledger",color:ACTUAL},
      {name:"Forecast (not real)",color:FORECAST}]
    :[{name:"Balance > "+alertLabel,color:GREEN},
      {name:"Balance ≤ "+alertLabel,color:RED}];

  const renderCircle=(point,color,key)=> showMarkers ?
    <circle key={key} cx={point.x} cy={point.y}
      r={active===point.index||selectedIndex===point.index?4.5:2.6}
      fill={color} stroke="#f3e4c7" strokeWidth=".8"
      pointerEvents="none">
      <title>{valueLabel(point.row,kind)}</title>
    </circle>:null;

  return <div ref={rootRef}
    className={"mh-native-chart"+(compact?" mh-native-chart--compact":"")+
      (isMobile?" mh-native-chart--mobile":"")}
    aria-label={label} onMouseLeave={()=>setActive(null)}>
    <svg viewBox={"0 0 "+width+" "+height} width="100%" height="100%"
      role="group" aria-label={label+" - "+data.length+" dates"}>
      <title>{label}</title>
      <desc>Financial data for the selected period. Tap or focus a date to inspect it.</desc>
      <rect x={margin.left} y={margin.top} width={pw} height={ph}
        fill="#071624" fillOpacity=".16" rx="4"/>
      {view.ticks.map((tick,index)=><g key={"tick-"+index}>
        <line x1={margin.left} x2={margin.left+pw}
          y1={y(tick)} y2={y(tick)}
          stroke="#879cac" strokeOpacity={index===0?.36:.22}
          strokeDasharray={index===0?"":"3 5"}/>
        <text x={margin.left-7} y={y(tick)+3.5} fill="#c9d7df"
          fontSize={isMobile?9.5:10.5} textAnchor="end">{compactRM(tick)}</text>
      </g>)}
      <line x1={margin.left} x2={margin.left+pw} y1={baseline} y2={baseline}
        stroke="#bea989" strokeOpacity=".65" strokeWidth="1"/>
      {data.map((row,index)=>ticks.has(index)?<text key={"date-"+index}
        x={position(index)} y={height-(isMobile?8:9)} fill="#d3dce3"
        fontSize={isMobile?9.5:10.5}
        textAnchor={kind==="bars"?"middle":index===0?"start":index===data.length-1?"end":"middle"}>
        {axisLabel(row)}
      </text>:null)}
      {kind==="bars"?data.map((row,index)=>{
        const gap=Math.min(1.5,barSlot*.12);
        const band=Math.max(.15,Math.min(13,(barSlot-gap)/2));
        return fields.map((field,offset)=>{
          const value=chartNumber(row?.[field]);
          if(value===null)return null;
          const barX=position(index)+(offset===0?-band-gap/2:gap/2);
          const pointY=y(value);
          return <rect key={index+"-"+field} x={barX}
            y={Math.min(baseline,pointY)}
            width={band} height={Math.max(1.4,Math.abs(baseline-pointY))}
            fill={palette[field]} fillOpacity={active===null||active===index?1:.7}
            rx="1.3" pointerEvents="none">
            <title>{valueLabel(row,kind)}</title>
          </rect>;
        });
      }):kind==="balance"?<>
        {chartBalanceSegments(data,view,alertLimit).map((segment,index)=>
          <line key={"balance-segment-"+index}
            x1={segment.x1} y1={segment.y1}
            x2={segment.x2} y2={segment.y2}
            stroke={segment.above?GREEN:RED}
            strokeWidth={compact?2.8:3}
            strokeLinecap="round" vectorEffect="non-scaling-stroke"
            pointerEvents="none"/>)}
        {data.map((row,index)=>{
          const value=chartNumber(row?.balanceGreen)??chartNumber(row?.balanceRed);
          if(value===null)return null;
          const point={x:x(index),y:y(value),index,row};
          // One valid day with no adjacent valid data must still show a small line
          // even on phone when individual point circles are intentionally hidden.
          const previous=index>0?
            chartNumber(data[index-1]?.balanceGreen)??chartNumber(data[index-1]?.balanceRed):null;
          const next=index+1<data.length?
            chartNumber(data[index+1]?.balanceGreen)??chartNumber(data[index+1]?.balanceRed):null;
          return <g key={"balance-point-"+index}>
            {!showMarkers&&previous===null&&next===null&&
              <line x1={point.x-7} x2={point.x+7} y1={point.y} y2={point.y}
                stroke={value>alertLimit?GREEN:RED} strokeWidth="3"
                strokeLinecap="round" pointerEvents="none"/>}
            {renderCircle(point,value>alertLimit?GREEN:RED,"point-"+index)}
          </g>;
        })}
      </>:fields.map(field=>{
        const color=kind==="expense"?BLUE:palette[field];
        const runs=chartLineRuns(data,field,view);
        return <g key={field}>
          {runs.map((run,runIndex)=>run.length>1?
            <polyline key={"run-"+runIndex} fill="none"
              points={run.map(p=>p.x+","+p.y).join(" ")}
              stroke={color}
              strokeDasharray={kind==="forecast"&&field==="forecast"?"7 5":undefined}
              strokeWidth={compact?2.8:3} strokeLinejoin="round"
              strokeLinecap="round" vectorEffect="non-scaling-stroke"
              pointerEvents="none"/>:
            <line key={"single-"+runIndex} x1={run[0].x-7} x2={run[0].x+7}
              y1={run[0].y} y2={run[0].y} stroke={color}
              strokeWidth="3" strokeLinecap="round" pointerEvents="none"/>)}
          {runs.flatMap(run=>run.map(point=>renderCircle(point,color,field+"-"+point.index)))}
        </g>;
      })}
      {data.map((row,index)=>{
        const spacing=kind==="bars"?barSlot:data.length<2?pw:pw/(data.length-1);
        const left=Math.max(margin.left,position(index)-spacing/2);
        const right=Math.min(margin.left+pw,position(index)+spacing/2);
        return <rect key={"hit-"+index} {...marker(index)}
          x={left} y={margin.top} width={Math.max(1,right-left)}
          height={ph} fill="transparent" style={{cursor:"crosshair",touchAction:"pan-y"}}/>;
      })}
      {(active!==null||selectedIndex>=0)&&(()=>{
        const index=active!==null?active:selectedIndex;
        return <line x1={position(index)} x2={position(index)}
          y1={margin.top} y2={margin.top+ph}
          stroke="#f5cd8b" strokeDasharray="3 4" strokeOpacity=".6"
          pointerEvents="none"/>;
      })()}
    </svg>
    {selected&&<div className="mh-native-chart__tooltip" role="status">
      {valueLabel(selected,kind)}
    </div>}
    {!selected&&<div className="mh-native-chart__legend" aria-label="Chart legend">
      {legend.map(item=><span key={item.name}>
        <i style={{backgroundColor:item.color}}/>{item.name}
      </span>)}
    </div>}
  </div>;
}
