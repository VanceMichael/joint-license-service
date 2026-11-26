import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startVendor } from './vendor.mjs';

const providers = JSON.parse(await readFile('fixtures/vendors.json','utf8'));
const close = server => new Promise(resolve => {server.close(resolve); server.closeAllConnections();});
test('每个协作通道接单落盘、拒绝冲突并支持进程恢复',async()=>{
  const stateDirectory=await mkdtemp(join(tmpdir(),'vendor-'));
  let server;
  try {
    server=await startVendor({stateDirectory});
    let base=`http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(base+'/health')).status,200);
    for(const provider of providers) {
      const url=base+`/vendors/${provider.name}/commands`;
      const headers={'content-type':'application/json','idempotency-key':'command-1'};
      const req={method:'POST',headers,body:JSON.stringify(provider.example)};
      assert.equal((await fetch(url,req)).status,202);
      assert.equal((await fetch(url,req)).status,200);
      assert.equal((await fetch(url,{...req,body:JSON.stringify({...provider.example,extra:'changed'})})).status,409);
      assert.equal((await fetch(url,{...req,headers:{...headers,'idempotency-key':'missing'},body:'{}'})).status,422);
      assert.equal((await fetch(base+`/control/${provider.name}/commands/command-1`,{method:'PUT',body:JSON.stringify({status:'completed'})})).status,403);
      assert.equal((await fetch(base+`/control/${provider.name}/commands/command-1`,{method:'PUT',headers:{authorization:'Bearer synthetic-control'},body:JSON.stringify({status:'completed',result:{receiptId:'receipt-1'}})})).status,200);
    }
    const lostProvider=providers[0];
    await assert.rejects(fetch(base+`/vendors/${lostProvider.name}/commands`,{method:'POST',headers:{'idempotency-key':'lost-ack','x-synthetic-response':'disconnect'},body:JSON.stringify(lostProvider.example)}));
    await close(server);server=await startVendor({stateDirectory});
    base=`http://127.0.0.1:${server.address().port}`;
    for(const provider of providers) {
      const restored=await (await fetch(base+`/vendors/${provider.name}/commands/command-1`)).json();
      assert.equal(restored.status,'completed');assert.equal(restored.result.receiptId,'receipt-1');
    }
    assert.equal((await (await fetch(base+`/vendors/${lostProvider.name}/commands/lost-ack`)).json()).status,'accepted');
  } finally {if(server) await close(server);await rm(stateDirectory,{recursive:true,force:true});}
});
test('合成资料的引用及外部文件摘要完整',async()=>{
  const records=JSON.parse(await readFile('fixtures/records.json','utf8'));
  const ids=new Set(records.map(row=>row.id));assert.equal(ids.size,records.length);
  for(const row of records) for(const link of row.links) assert.ok(ids.has(link),`${row.id}: ${link}`);
  const {createHash}=await import('node:crypto');
  for(const row of records) if(row.path) {
    const bytes=await readFile(row.path);assert.ok(bytes.length>0);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);
  }
});
