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


// An out-of-order server edit response may arrive AFTER a newer Realtime
// snapshot. Keep the newer version; never insert a row absent from active state.
export function replaceExistingVersionedRow(rows,incoming){
  if(!Array.isArray(rows)||!incoming?.id)
    throw new Error("Cannot reconcile invalid finance edit.");
  return rows.map(row=>{
    if(row.id!==incoming.id)return row;
    const newer=Number(row.version)>Number(incoming.version);
    return newer?row:incoming;
  });
}

// A delete/restore response is obsolete if ANY current active/trash snapshot
// contains the same UUID with a strictly newer version. Pure, read-only.
export function hasNewerVersion(incoming,...groups){
  if(!incoming?.id)return false;
  return groups.some(rows=>Array.isArray(rows)&&rows.some(row=>
    row.id===incoming.id && Number(row.version)>Number(incoming.version)));
}
