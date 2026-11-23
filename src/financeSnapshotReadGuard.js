// Read-only client snapshot commit guard. Never mutates finance tables.
// Acknowledged local writes invalidate snapshots started earlier; the entire
// verified cloud snapshot must be re-read before it may replace visible data.
export async function loadSnapshotAfterWriteStability(
  readSnapshot,getWriteEpoch,isCurrent,maxAttempts=3
) {
  if(typeof readSnapshot!=="function"||typeof getWriteEpoch!=="function"||
     typeof isCurrent!=="function"||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>5)
    throw Error("Invalid finance snapshot read guard.");
  for(let attempt=0;attempt<maxAttempts;attempt++){
    if(!isCurrent())return null;
    const epoch=getWriteEpoch();
    const snapshot=await readSnapshot();
    if(!isCurrent())return null;
    if(epoch===getWriteEpoch())return snapshot;
  }
  throw Error("Finance writes overlapped refresh. Old snapshot rejected; retry after writes settle.");
}
