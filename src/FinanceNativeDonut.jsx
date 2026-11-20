import React from "react";
import {chartPercentages} from "./financeChartPlot.js";

// Deterministic ring arcs; no Recharts/ResizeObserver needed for fixed 212px donut.
export default function FinanceNativeDonut({entries,highlighted,setHighlighted,colorFor,money}){
  const {slices}=chartPercentages(entries);
  const r=77,cx=106,cy=106,circ=2*Math.PI*r;
  return <svg role="group" aria-label="Payment method donut chart" width="100%" height="100%"
    viewBox="0 0 212 212" className="mh-native-donut">
    <title>Payment method ratio</title>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0b1c2b" strokeWidth="26"/>
    {slices.map(slice=>{
      const length=(slice.end-slice.start)*circ;
      const faded=highlighted&&highlighted!==slice.name;
      return <circle key={slice.name}
        cx={cx} cy={cy} r={r} fill="none"
        stroke={colorFor(slice.name)}
        strokeWidth={highlighted===slice.name?27:24}
        strokeDasharray={Math.max(.1,length-2.3)+" "+(circ-Math.max(.1,length-2.3))}
        strokeDashoffset={-slice.start*circ}
        transform={"rotate(-90 "+cx+" "+cy+")"}
        strokeLinecap="butt" opacity={faded?.4:1}
        role="button" tabIndex={0} aria-label={slice.name+" "+slice.percent.toFixed(1)+"% "+money(slice.value)}
        onMouseEnter={()=>setHighlighted(slice.name)}
        onMouseLeave={()=>setHighlighted("")}
        onFocus={()=>setHighlighted(slice.name)}
        onBlur={()=>setHighlighted("")}
        onClick={()=>setHighlighted(slice.name)}
        onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setHighlighted(slice.name);}}}>
        <title>{slice.name+" · "+slice.percent.toFixed(1)+"% · "+money(slice.value)}</title>
      </circle>;
    })}
    <circle cx={cx} cy={cy} r="57" fill="#152d40" stroke="#ad8754" strokeWidth="1.5"
      pointerEvents="none"/>
    <circle cx={cx} cy={cy} r="54" fill="none" stroke="#658394" strokeWidth="1"
      strokeDasharray="1 9" pointerEvents="none"/>
  </svg>;
}
