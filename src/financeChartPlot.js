/* Read-only chart geometry. Never changes record amounts, dates, categories or balances. */
export function chartNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function chartFields(kind) {
  if(Array.isArray(kind) && kind.length && kind.every(field=>typeof field==="string" && /^[a-zA-Z][a-zA-Z0-9]*$/.test(field))) return [...kind];
  if (kind === "bars") return ["income", "expense"];
  if (kind === "balance") return ["balanceGreen", "balanceRed"];
  if (kind === "expense") return ["expense"];
  if (kind === "forecast") return ["actual", "forecast"];
  throw new Error("Unsupported chart kind");
}
// Date-driven trend geometry. Dates are parsed as UTC calendar days (not the
// device time zone), so missing days occupy their real share of the X axis.
// Invalid, repeated or unsorted dates retain the legacy index spacing rather
// than being silently re-ordered or corrupting a chart.
export function chartDayFractions(rows) {
  if(!Array.isArray(rows)||rows.length<2)return null;
  const days=[];
  for(const row of rows){
    const date=String(row?.dateKey||row?.date||"");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
    const milliseconds=Date.parse(date+"T00:00:00Z");
    if(!Number.isFinite(milliseconds)||
      new Date(milliseconds).toISOString().slice(0,10)!==date)return null;
    const day=milliseconds/86400000;
    if(days.length&&day<=days[days.length-1])return null;
    days.push(day);
  }
  const span=days[days.length-1]-days[0];
  return span>0?days.map(day=>(day-days[0])/span):null;
}

// Sparse dates can cluster near one side of the chart. Choose tick labels by
// pixel distance and always preserve the first/last day, not by row index.
export function chartTimeTickIndices(rows,view,maxLabels=5,minGap=58) {
  const data=Array.isArray(rows)?rows:[];
  if(data.length<=1)return chartTickIndices(data.length,maxLabels);
  if(!view?.dateFractions)return chartTickIndices(data.length,maxLabels);
  const count=Math.max(2,Math.min(data.length,Math.floor(Number(maxLabels)||5),
    Math.floor(view.pw/Math.max(1,minGap))+1));
  const last=data.length-1;
  const selected=[0];
  for(let step=1;step<count-1;step++){
    const target=view.margin.left+view.pw*step/(count-1);
    const limit=view.x(last)-minGap;
    let best=-1,smallest=Infinity;
    for(let i=1;i<last;i++){
      const px=view.x(i);
      if(px<view.x(selected[selected.length-1])+minGap||px>limit)continue;
      const distance=Math.abs(px-target);
      if(distance<smallest){best=i;smallest=distance;}
    }
    if(best>=0)selected.push(best);
  }
  selected.push(last);
  return [...new Set(selected)].sort((a,b)=>a-b);
}

export function chartViewport(rows, kind, width, height) {
  const data = Array.isArray(rows) ? rows : [];
  const fields = chartFields(kind);
  const w = Math.max(190, Number(width) || 640);
  const h = Math.max(108, Number(height) || 240);
  const compact = h < 180;
  const margin = { left: compact ? 42 : 58, right: 12, top: 14, bottom: compact ? 24 : 32 };
  const pw = Math.max(1, w - margin.left - margin.right);
  const ph = Math.max(1, h - margin.top - margin.bottom);
  const values = data.flatMap(row => fields.map(field => chartNumber(row?.[field]))).filter(n => n !== null);
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  // Always include 0, including for negative balances. Never coerce a missing balance to 0.
  const spread = max - min;
  const pad = spread ? spread * .08 : 1;
  const low = min < 0 ? min - pad : 0;
  const high = max > 0 ? max + pad : spread ? 0 : 1;
  const range = Math.max(.000001, high - low);
  const dateFractions=chartDayFractions(data);
  const x = i => data.length <= 1 ? margin.left + pw / 2 :
    margin.left + (dateFractions ? dateFractions[i] : i/(data.length-1))*pw;
  const y = value => margin.top + (high - value) / range * ph;
  return {
    data, fields, width:w, height:h, compact, margin, pw, ph, low, high, dateFractions,
    x, y, ticks: Array.from({length:5}, (_, i) => low + (high - low) * i / 4),
    baseline:y(0),
  };
}
export function chartLineSegments(rows, field, view) {
  const points = [];
  for (let i = 0; i < rows.length; i++) {
    const value = chartNumber(rows[i]?.[field]);
    if (value !== null) points.push({x:view.x(i),y:view.y(value),value,index:i,row:rows[i]});
  }
  return points;
}
export function chartPercentages(entries) {
  const good = (Array.isArray(entries) ? entries : [])
    .map(entry => ({...entry, value:chartNumber(entry?.value)}))
    .filter(entry => entry.value !== null && entry.value > 0);
  const total = good.reduce((n,entry) => n + entry.value,0);
  if (!total) return {total:0,slices:[]};
  let previous=0;
  const slices=good.map(entry => {
    const start=previous/total;
    previous+=entry.value;
    return {...entry,start,end:previous/total,percent:entry.value/total*100};
  });
  return {total,slices};
}


/* Pixel-aware X ticks keep date labels separated on narrow Android screens. */
export function chartTickIndices(length,maxLabels=5) {
  const count=Math.max(0,Math.floor(Number(length)||0));
  if(!count)return [];
  if(count===1)return [0];
  const labels=Math.min(count,Math.max(2,Math.floor(Number(maxLabels)||5)));
  return [...new Set(Array.from({length:labels},(_,i)=>Math.round(i*(count-1)/(labels-1))))];
}

/* Preserve gaps: a null future actual balance must not be joined to later forecast rows. */
export function chartLineRuns(rows,field,view) {
  const runs=[];
  let current=[];
  for(let i=0;i<rows.length;i++){
    const value=chartNumber(rows[i]?.[field]);
    if(value===null){if(current.length)runs.push(current);current=[];continue;}
    current.push({index:i,value,x:view.x(i),y:view.y(value),row:rows[i]});
  }
  if(current.length)runs.push(current);
  return runs;
}

/* Draw a continuous threshold-colored real balance. Changing threshold never
 * changes the underlying value; crossing segments split at the exact crossing. */
export function chartBalanceSegments(rows,view,limit=1500) {
  const threshold=chartNumber(limit)??1500;
  const data=Array.isArray(rows)?rows:[];
  const get=row=>chartNumber(row?.balanceGreen)??chartNumber(row?.balanceRed);
  const result=[];
  for(let i=1;i<data.length;i++){
    const before=get(data[i-1]),after=get(data[i]);
    if(before===null||after===null)continue;
    const x1=view.x(i-1),x2=view.x(i);
    const y1=view.y(before),y2=view.y(after);
    const aAbove=before>threshold,bAbove=after>threshold;
    if(aAbove===bAbove){
      result.push({x1,y1,x2,y2,above:aAbove,start:i-1,end:i});
    } else {
      const fraction=(threshold-before)/(after-before);
      const middleX=x1+(x2-x1)*fraction, middleY=view.y(threshold);
      result.push({x1,y1,x2:middleX,y2:middleY,above:aAbove,start:i-1,end:i});
      result.push({x1:middleX,y1:middleY,x2,y2,above:bAbove,start:i-1,end:i});
    }
  }
  return result;
}
