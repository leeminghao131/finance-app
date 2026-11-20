import React,{useEffect,useRef,useState} from "react";
import {chartFields,chartViewport,chartNumber,chartLineSegments} from "./financeChartPlot.js";

const GREEN="#22c55e", RED="#ef4444", BLUE="#3b82f6";
const compactRM = value => {
  const n=Number(value)||0;
  const abs=Math.abs(n);
  if(abs>=1000000) return (n/1000000).toFixed(1)+"m";
  if(abs>=1000) return (n/1000).toFixed(1)+"k";
  return Number(n.toFixed(1)).toLocaleString("en-MY");
};
const money = value => "RM " + (Number(value)||0).toLocaleString("en-MY",{
  minimumFractionDigits:2,maximumFractionDigits:2
});
const palette = {income:GREEN,expense:RED,balanceGreen:GREEN,balanceRed:RED};
function valueLabel(row,kind){
  const date=row?.dateKey || row?.day || "";
  if(kind==="bars")return date+" · Income "+money(row.income)+" · Expense "+money(row.expense);
  if(kind==="expense")return date+" · Expense "+money(row.expense);
  const val=chartNumber(row?.balanceGreen)??chartNumber(row?.balanceRed);
  return date+(val===null?" · Future / no actual balance":" · Balance "+money(val));
}

// Native SVG, no Recharts ResizeObserver composition or filter/animation pipeline.
// Draws from the exact rows already calculated by App; never recomputes a financial total.
export default function FinanceNativeChart({
  rows=[],kind="expense",selectedDate="",onSelectDate=null,compact=false,alertLimit=1500,
  label="Financial chart"
}){
  const rootRef=useRef(null);
  const [size,setSize]=useState({width:560,height:compact?144:260});
  const [active,setActive]=useState(null);
  useEffect(()=>{
    const element=rootRef.current;
    if(!element)return undefined;
    const update=()=>{
      const rect=element.getBoundingClientRect();
      if(rect.width<2 || rect.height<2)return;
      const width=Math.max(190,Math.round(rect.width));
      const height=Math.max(108,Math.round(rect.height));
      setSize(previous=>previous.width===width&&previous.height===height?previous:{width,height});
    };
    update();
    if(typeof ResizeObserver==="undefined")return undefined;
    const observer=new ResizeObserver(update);
    observer.observe(element);
    return ()=>observer.disconnect();
  },[compact]);
  const data=Array.isArray(rows)?rows:[];
  const view=chartViewport(data,kind,size.width,size.height);
  const {width,height,margin,pw,ph,x,y,baseline}=view;
  const fields=chartFields(kind);
  const tickStep=Math.max(1,Math.ceil(data.length/(compact?4:7)));
  const ticks=new Set([0,data.length-1]);
  for(let i=0;i<data.length;i+=tickStep)ticks.add(i);
  const selectedIndex=data.findIndex(row=>row?.dateKey===selectedDate);
  const [hoverIndex,setHoverIndex]=[active,setActive];
  const choose=index=>{
    setHoverIndex(index);
    if(typeof onSelectDate==="function" && data[index]) onSelectDate(data[index]);
  };
  const marker=index=>{
    const row=data[index];
    return {role:typeof onSelectDate==="function"?"button":"img",
      tabIndex:0,"aria-label":valueLabel(row,kind),
      onMouseEnter:()=>choose(index),onFocus:()=>choose(index),
      onClick:()=>choose(index),onTouchStart:()=>choose(index),
      onKeyDown:event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();choose(index);}}};
  };
  const selected=hoverIndex===null?null:data[hoverIndex];
  const showLabel=selected?valueLabel(selected,kind):null;
  if(!data.length) return <div className="mh-native-chart-empty" role="status">No data for this period.</div>;
  const alertLabel="RM"+Number(alertLimit||1500).toLocaleString("en-MY",{maximumFractionDigits:2});
  const legend=kind==="bars"?[
      {name:"Income",color:GREEN},{name:"Expense",color:RED}]
    :kind==="expense"?[{name:"Expense",color:BLUE}]:[
      {name:"Balance > "+alertLabel,color:GREEN},
      {name:"Balance ≤ "+alertLabel,color:RED}];
  return <div ref={rootRef} className="mh-native-chart" aria-label={label}>
    <svg viewBox={"0 0 "+width+" "+height} width="100%" height="100%"
      role="group" aria-label={label+" - "+data.length+" dates"}>
      <title>{label}</title>
      <desc>Actual data from the selected finance period. Hover, focus or tap to inspect values.</desc>
      <rect x={margin.left} y={margin.top} width={pw} height={ph} fill="#071624" fillOpacity=".20" rx="5"/>
      {view.ticks.map((tick,index)=><g key={"tick-"+index}>
        <line x1={margin.left} x2={margin.left+pw} y1={y(tick)} y2={y(tick)}
          stroke="#8198a9" strokeOpacity={index===0?.32:.23} strokeDasharray={index===0?"":"3 5"}/>
        <text x={margin.left-7} y={y(tick)+3.5} fill="#c9d4dc"
          fontSize={compact?9:11} textAnchor="end">{compactRM(tick)}</text>
      </g>)}
      <line x1={margin.left} x2={margin.left+pw} y1={baseline} y2={baseline}
        stroke="#beaa8a" strokeOpacity=".70" strokeWidth="1.1"/>
      {data.map((row,index)=>ticks.has(index)?<text key={"date-"+index}
        x={x(index)} y={height-(compact?6:9)} fontSize={compact?9:10}
        fill="#d1d9df" textAnchor="middle">{String(row?.day||row?.dateKey||"").slice(0,compact?6:10)}</text>:null)}
      {kind==="bars"?data.map((row,index)=>{
        const band=Math.min(16,Math.max(2.2,pw/Math.max(4,data.length*3.3)));
        return fields.map((field,offset)=>{
          const value=chartNumber(row?.[field]);
          if(value===null)return null;
          const barX=x(index)+(offset===0?-band-1:1);
          const pointY=y(value);
          return <rect key={index+"-"+field} x={barX} y={Math.min(baseline,pointY)}
            width={band} height={Math.max(1.4,Math.abs(baseline-pointY))}
            fill={palette[field]} fillOpacity={active===null||active===index?1:.65} rx="1.5">
            <title>{valueLabel(row,kind)}</title>
          </rect>;
        });
      }):fields.map(field=>{
        const points=chartLineSegments(data,field,view);
        const color=kind==="expense"?BLUE:palette[field];
        return <g key={field}>
          {points.length>1&&<polyline fill="none" points={points.map(p=>p.x+","+p.y).join(" ")}
            stroke={color} strokeWidth={compact?2.8:3} strokeLinejoin="round"
            strokeLinecap="round" vectorEffect="non-scaling-stroke"/>}
          {points.map(p=><circle key={p.index} cx={p.x} cy={p.y}
            r={active===p.index||selectedIndex===p.index?5:compact?2.6:3.5}
            fill={color} stroke="#e5dfd0" strokeWidth="1.2">
            <title>{valueLabel(p.row,kind)}</title>
          </circle>)}
        </g>;
      })}
      {data.map((row,index)=>{
        const spacing=data.length<2?pw:pw/(data.length-1);
        const left=Math.max(margin.left,x(index)-spacing/2);
        const right=Math.min(margin.left+pw,x(index)+spacing/2);
        return <rect key={"hit-"+index} {...marker(index)}
          x={left} y={margin.top} width={Math.max(1,right-left)}
          height={ph} fill="transparent" style={{cursor:"crosshair"}}/>;
      })}
      {(hoverIndex!==null||selectedIndex>=0)&&(()=>{
        const index=hoverIndex!==null?hoverIndex:selectedIndex;
        return <line x1={x(index)} x2={x(index)} y1={margin.top} y2={margin.top+ph}
          stroke="#f6cd88" strokeDasharray="4 4" strokeOpacity=".6" pointerEvents="none"/>;
      })()}
    </svg>
    {showLabel&&<div className="mh-native-chart__tooltip" role="status">{showLabel}</div>}
    {!showLabel&&<div className="mh-native-chart__legend" aria-label="Chart legend">{legend.map(item=><span key={item.name}><i style={{backgroundColor:item.color}}/>{item.name}</span>)}</div>}
  </div>;
}
