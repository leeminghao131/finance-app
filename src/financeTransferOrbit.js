// Pure deterministic radial geometry for the Stage 4 Transfer UI.
// Does not read, write or mutate financial records or method balance state.
export function orbitGeometry(methods=[]){
  const unique=[...new Set(methods.map(value=>String(value||"").trim()).filter(Boolean))];
  const count=unique.length;
  // Every method shares one equally spaced ring. Large rings scroll on mobile
  // instead of shrinking touch targets, hiding custom methods or overlapping.
  const radius=count<3?143:Math.max(143,Math.ceil(112/(2*Math.sin(Math.PI/count))));
  const center=radius+56,size=center*2;
  const nodes=unique.map((method,index)=>{
    const angle=-Math.PI/2+index*2*Math.PI/count;
    return {method,index,x:center+Math.cos(angle)*radius,y:center+Math.sin(angle)*radius};
  });
  return {nodes,count,radius,center,size};
}
export function orbitCurve(start,end,center){
  if(!start||!end)return "";
  const bend=(Math.hypot(start.x-end.x,start.y-end.y)<10)?-20:0;
  return "M "+start.x.toFixed(1)+" "+start.y.toFixed(1)+
    " Q "+center.toFixed(1)+" "+(center+bend).toFixed(1)+
    " "+end.x.toFixed(1)+" "+end.y.toFixed(1);
}
