/* Read-only chart geometry. Never changes record amounts, dates, categories or balances. */
export function chartNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function chartFields(kind) {
  if (kind === "bars") return ["income", "expense"];
  if (kind === "balance") return ["balanceGreen", "balanceRed"];
  if (kind === "expense") return ["expense"];
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
