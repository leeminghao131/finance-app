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

export async function importReviewedCsvRows(client,fileSha256,selectedRecords,onProgress) {
  if(!Array.isArray(selectedRecords)||selectedRecords.length===0)throw new Error("Choose valid records to import.");
  const unique=new Set(selectedRecords.map(row=>row.source_row));
  if(unique.size!==selectedRecords.length)throw new Error("Duplicate source-row numbers in import selection.");
  let inserted=0,alreadyImported=0,processed=0;
  for(let start=0;start<selectedRecords.length;start+=CHUNK_SIZE) {
    const batch=selectedRecords.slice(start,start+CHUNK_SIZE);
    const {data,error}=await client.rpc("finance_import_csv_rows",{
      p_file_sha256:fileSha256,p_rows:batch,
    });
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
