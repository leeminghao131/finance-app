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
  const x = i => data.length <= 1 ? margin.left + pw / 2 :
    margin.left + i / (data.length - 1) * pw;
  const y = value => margin.top + (high - value) / range * ph;
  return {
    data, fields, width:w, height:h, compact, margin, pw, ph, low, high,
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
