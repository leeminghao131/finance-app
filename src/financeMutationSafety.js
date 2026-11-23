// Pure safety helpers for the existing finance UI.
// No storage, network, SQL or account permissions are changed here.
export function isCurrentFinanceOwner(liveUserIdRef,owner){
  return Boolean(owner&&liveUserIdRef?.current===owner);
}

export function matchesOpenedVersion(openedVersion,currentVersion){
  const opened=Number(openedVersion),current=Number(currentVersion);
  return Number.isSafeInteger(opened)&&opened>=1&&
    Number.isSafeInteger(current)&&current>=1&&opened===current;
}

export function removeRowById(rows,id){
  return rows.filter(row=>row.id!==id);
}

// A Realtime refresh and a server write response may arrive in either order.
// Never append the same ID twice, and never replace a newer row with an older
// server response. Keeps the previous sort position for an existing row.
export function upsertUniqueVersionedRow(rows,incoming){
  if(!Array.isArray(rows)||!incoming?.id)
    throw new Error("Cannot reconcile invalid finance row.");
  const same=rows.filter(row=>row.id===incoming.id);
  const candidate=same.reduce((best,row)=>{
    const a=Number(best.version),b=Number(row.version);
    return Number.isFinite(b)&&(!Number.isFinite(a)||b>a)?row:best;
  },incoming);
  if(!same.length)return [candidate,...rows];
  let seen=false;
  return rows.flatMap(row=>{
    if(row.id!==incoming.id)return [row];
    if(seen)return [];
    seen=true;
    return [candidate];
  });
}
