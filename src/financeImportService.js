const CHUNK_SIZE = 100;

export async function findImportedSourceRows(client,userId,fileSha256) {
  const found=new Set();
  for(let start=0;start<1000000;start+=500) {
    const {data,error}=await client.from("finance_import_items")
      .select("source_row")
      .eq("user_id",userId)
      .eq("file_sha256",fileSha256)
      .order("source_row",{ascending:true})
      .range(start,start+499);
    if(error)throw error;
    if(!Array.isArray(data))throw new Error("Could not verify previous import markers.");
    for(const row of data)found.add(Number(row.source_row));
    if(data.length<500)break;
  }
  return found;
}

// Stop long CSV imports if the owner changes between 100-row chunks.
// Supabase RLS remains the authority; never trust cached React identity alone.
async function requireImportOwner(client,options) {
  if(!options?.ownerId)return;
  if(typeof options.isOwnerCurrent!=="function" || !options.isOwnerCurrent())
    throw new Error("CSV import stopped: account changed. Check import history before retrying.");
  if(typeof client?.auth?.getUser!=="function"||typeof client?.auth?.getSession!=="function")
    throw new Error("CSV import stopped: login could not be verified.");
  const sessionResult=await client.auth.getSession();
  const token=sessionResult.data?.session?.access_token;
  if(sessionResult.error||!token||sessionResult.data?.session?.user?.id!==options.ownerId)
    throw new Error("CSV import stopped: original session unavailable.");
  const {data,error}=await client.auth.getUser(token);
  if(error||data?.user?.id!==options.ownerId||!options.isOwnerCurrent())
    throw new Error("CSV import stopped: authenticated account changed. Check previous import markers.");
  return token;
}
export async function importReviewedCsvRows(client,fileSha256,selectedRecords,onProgress,options={}) {
  if(!Array.isArray(selectedRecords)||selectedRecords.length===0)throw new Error("Choose valid records to import.");
  const unique=new Set(selectedRecords.map(row=>row.source_row));
  if(unique.size!==selectedRecords.length)throw new Error("Duplicate source-row numbers in import selection.");
  let inserted=0,alreadyImported=0,processed=0;
  for(let start=0;start<selectedRecords.length;start+=CHUNK_SIZE) {
    const token=await requireImportOwner(client,options);
    const batch=selectedRecords.slice(start,start+CHUNK_SIZE);
    const rpc=batch.some(row=>row.fx_currency)?"finance_import_fx_csv_rows":"finance_import_csv_rows";
    const request=client.rpc(rpc,{
      p_file_sha256:fileSha256,p_rows:batch,
    });
    // Pin the verified original JWT to this single request. A later auth
    // change must never silently replace the bearer token of a queued RPC.
    if(options.ownerId&&(!token||typeof request?.setHeader!=="function"))
      throw new Error("CSV import cannot safely bind the original account.");
    const {data,error}=await (options.ownerId?request.setHeader("Authorization","Bearer "+token):request);
    if(options?.ownerId)await requireImportOwner(client,options);
    if(error)throw new Error("Import stopped after "+processed+" of "+selectedRecords.length+
      " checked rows; retry safely using the same file. "+error.message);
    if(!Array.isArray(data) || data.length!==batch.length) {
      throw new Error("Database returned an incomplete import acknowledgement. Retry the same file safely.");
    }
    const ack=new Map(data.map(row=>[Number(row.source_row),row]));
    for(const record of batch) {
      const status=ack.get(record.source_row)?.import_status;
      if(status==="inserted")inserted++;
      else if(status==="already_imported")alreadyImported++;
      else throw new Error("Import acknowledgement mismatch. Retry without creating duplicates.");
    }
    processed+=batch.length;
    onProgress?.({processed,total:selectedRecords.length,inserted,alreadyImported});
  }
  return {processed,total:selectedRecords.length,inserted,alreadyImported};
}
