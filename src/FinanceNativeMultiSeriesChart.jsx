import React,{useEffect,useRef,useState} from "react";
import {
  chartNumber,chartViewport,chartTickIndices,chartLineRuns
} from "./financeChartPlot.js";

const money=value=>"RM "+Number(value).toLocaleString("en-MY",{
  minimumFractionDigits:2,maximumFractionDigits:2
});
const shortNumber=value=>{
  const n=Number(value)||0;
  if(Math.abs(n)>=1e6)return (n/1e6).toFixed(1)+"m";
  if(Math.abs(n)>=1000)return (n/1000).toFixed(1)+"k";
  return Number(n.toFixed(0)).toLocaleString("en-MY");
};

// Presentation-only renderer for monthly Comparison and What-if Simulator.
// Receives existing calculated records and series; does NOT calculate any money.
export default function FinanceNativeMultiSeriesChart({
  rows=[],series=[],xKey="month",mode="line",label="Finance comparison",
  maxTicksMobile=4,maxTicksDesktop=7
}){
  const rootRef=useRef(null);
  const [bounds,setBounds]=useState({width:560,height:260});
  const [active,setActive]=useState(null);
  useEffect(()=>{
    const root=rootRef.current;
    if(!root)return undefined;
    let frame=0;
    const measure=()=>{
      const rect=root.getBoundingClientRect(),parent=root.parentElement;
      const width=Math.max(190,Math.round(rect.width||root.clientWidth||parent?.clientWidth||560));
      const height=Math.max(115,Math.round(rect.height||root.clientHeight||parent?.clientHeight||260));
      setBounds(prev=>prev.width===width&&prev.height===height?prev:{width,height});
    };
    const schedule=()=>{if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
    measure();schedule();
    const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(schedule);
    observer?.observe(root);
    window.addEventListener("resize",schedule,{passive:true});
    return ()=>{if(frame)cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener("resize",schedule);};
  },[rows.length,mode,series.length]);

  const data=Array.isArray(rows)?rows:[];
  const displaySeries=(Array.isArray(series)?series:[]).filter(s=>s&&typeof s.key==="string"&&s.key);
  if(!data.length||!displaySeries.length)return <div className="mh-native-chart-empty" role="status">
    No chart data for this period.
  </div>;
  const view=chartViewport(data,displaySeries.map(s=>s.key),bounds.width,bounds.height);
  const {width,height,margin,pw,ph,y,baseline}=view;
  const isMobile=width<540;
  const maxTicks=isMobile?maxTicksMobile:maxTicksDesktop;
  const count=Math.max(2,Math.min(maxTicks,Math.floor(pw/(isMobile?77:86))+1));
  const ticks=new Set(chartTickIndices(data.length,count));
  const position=index=>mode==="bars"
    ?margin.left+pw*(index+.5)/Math.max(1,data.length)
    :view.x(index);
  const textForIndex=index=>{
    const row=data[index];
    const fields=displaySeries
      .map(s=>{const value=chartNumber(row?.[s.key]);return value===null?null:s.name+" "+money(value);})
      .filter(Boolean);
    return String(row?.[xKey]||"")+" · "+fields.join(" · ");
  };
  const barSpace=pw/Math.max(1,data.length);
  const groupWidth=Math.min(88,barSpace*.79);
  const barWidth=groupWidth/Math.max(1,displaySeries.length);
  const selected=active===null?null:data[active];
  return <div ref={rootRef} className={"mh-native-chart mh-native-chart--multi"+(isMobile?" mh-native-chart--mobile":"")}
    aria-label={label} onMouseLeave={()=>setActive(null)}>
    <svg viewBox={"0 0 "+width+" "+height} width="100%" height="100%" role="group"
      aria-label={label}>
      <title>{label}</title>
      <desc>Read-only series drawn from existing monthly financial comparisons or simulator results.</desc>
      <rect x={margin.left} y={margin.top} width={pw} height={ph} rx="4"
        fill="#081727" fillOpacity=".2"/>
      {view.ticks.map((tick,index)=><g key={"tick-"+index}>
        <line x1={margin.left} x2={margin.left+pw} y1={y(tick)} y2={y(tick)}
          stroke="#8da2ae" strokeOpacity=".22" strokeDasharray={index===0?undefined:"3 5"}/>
        <text x={margin.left-7} y={y(tick)+3} textAnchor="end"
          fontSize="10" fill="#d0dbe1">{shortNumber(tick)}</text>
      </g>)}
      <line x1={margin.left} x2={margin.left+pw} y1={baseline} y2={baseline}
        stroke="#dec096" strokeWidth="1" strokeOpacity=".65"/>
      {data.map((row,index)=>ticks.has(index)?<text key={"label-"+index}
        x={position(index)} y={height-9}
        fill="#d6dfe5" fontSize={isMobile?9.5:10.5}
        textAnchor={mode==="line"&&index===0?"start":
          mode==="line"&&index===data.length-1?"end":"middle"}>
        {String(row?.[xKey]||"").slice(0,mode==="bars"?9:10)}
      </text>:null)}
      {mode==="bars"?data.flatMap((row,index)=>displaySeries.map((serie,seriesIndex)=>{
        const value=chartNumber(row?.[serie.key]);
        if(value===null||value===0)return null;
        const top=y(value);
        return <rect key={index+"-"+serie.key}
          x={position(index)-groupWidth/2+seriesIndex*barWidth+1}
          y={Math.min(baseline,top)}
          width={Math.max(1,barWidth-2)}
          height={Math.max(1.5,Math.abs(baseline-top))}
          fill={serie.color||"#60a5fa"}
          fillOpacity={active===null||active===index?1:.67}
          rx="2" pointerEvents="none"><title>{textForIndex(index)}</title></rect>;
      })):displaySeries.map(serie=><g key={serie.key}>
        {chartLineRuns(data,serie.key,view).map((run,runIndex)=>run.length>1?
          <polyline key={runIndex} fill="none"
            points={run.map(p=>p.x+","+p.y).join(" ")}
            stroke={serie.color||"#60a5fa"}
            strokeDasharray={serie.dashed?"6 5":undefined}
            strokeWidth={serie.strong?3.4:2.6}
            strokeLinecap="round" strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" pointerEvents="none"/>:
          <line key={runIndex} x1={run[0].x-7} x2={run[0].x+7}
            y1={run[0].y} y2={run[0].y} stroke={serie.color||"#60a5fa"}
            strokeWidth="3" strokeLinecap="round" pointerEvents="none"/>)}
      </g>)}
      {data.map((row,index)=>{
        const spacing=mode==="bars"?barSpace:data.length>1?pw/(data.length-1):pw;
        const left=Math.max(margin.left,position(index)-spacing/2);
        const right=Math.min(margin.left+pw,position(index)+spacing/2);
        const select=()=>setActive(index);
        return <rect key={"hit-"+index}
          x={left} y={margin.top} width={Math.max(1,right-left)} height={ph}
          role="button" tabIndex={0} aria-label={textForIndex(index)}
          fill="transparent" style={{touchAction:"pan-y",cursor:"crosshair"}}
          onMouseEnter={select} onFocus={select} onClick={select}
          onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();select();}}}/>;
      })}
      {active!==null&&<line x1={position(active)} x2={position(active)}
        y1={margin.top} y2={margin.top+ph} stroke="#f5d5a0"
        strokeDasharray="3 4" strokeOpacity=".7" pointerEvents="none"/>}
    </svg>
    {selected&&<div className="mh-native-chart__tooltip" role="status">
      {textForIndex(active)}
    </div>}
    {!selected&&<div className="mh-native-chart__legend" aria-label="Chart legend">
      {displaySeries.map(serie=><span key={serie.key}>
        <i style={{backgroundColor:serie.color||"#60a5fa"}}/>{serie.name}
      </span>)}
    </div>}
  </div>;
}
