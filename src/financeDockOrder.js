// UI-only order, private to this browser and signed-in account. Never touches Supabase.
export const FINANCE_DOCK_IDS=Object.freeze([
  "wrapped","activity","simulator","comparison","savings","bills","review","accounts","data-tools"
]);
export function normalizeDockOrder(value){
  const seen=new Set();
  const known=Array.isArray(value)?value.filter(id=>{
    if(!FINANCE_DOCK_IDS.includes(id)||seen.has(id))return false;
    seen.add(id);return true;
  }):[];
  return [...known,...FINANCE_DOCK_IDS.filter(id=>!seen.has(id))];
}
export function moveDockItem(order,source,target){
  const normalized=normalizeDockOrder(order);
  if(source===target||!normalized.includes(source)||!normalized.includes(target))return normalized;
  const next=normalized.filter(id=>id!==source);
  // Insert at original target index: supports dragging to the very bottom.
  next.splice(normalized.indexOf(target),0,source);
  return next;
}
const storageKey=userId=>"mh-finance-dock-order:v1:"+userId;
export function readDockOrder(userId,storage=typeof localStorage!=="undefined"?localStorage:null){
  if(!userId||!storage)return [...FINANCE_DOCK_IDS];
  try{return normalizeDockOrder(JSON.parse(storage.getItem(storageKey(userId))));}
  catch{return [...FINANCE_DOCK_IDS];}
}
export function saveDockOrder(userId,order,storage=typeof localStorage!=="undefined"?localStorage:null){
  if(!userId||!storage)return false;
  try{storage.setItem(storageKey(userId),JSON.stringify(normalizeDockOrder(order)));return true;}
  catch{return false;}
}
