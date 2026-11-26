import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const send = (res, status, value) => {res.writeHead(status, {'content-type':'application/json; charset=utf-8'}); res.end(JSON.stringify(value));};
async function body(req) {
  let value = '';
  for await (const part of req) {value += part; if (value.length > 1024 * 1024) throw new Error('too_large');}
  return value ? JSON.parse(value) : {};
}
export async function startVendor({directory = '.', stateDirectory, port = 0, host = '127.0.0.1'} = {}) {
  if (!stateDirectory) throw new Error('state_directory_required');
  const vendors = JSON.parse(await readFile(resolve(directory, 'fixtures/vendors.json'), 'utf8'));
  await mkdir(stateDirectory, {recursive:true});
  const journal = resolve(stateDirectory, 'vendor-state.json');
  let state = {};
  try {state = JSON.parse(await readFile(journal, 'utf8'));} catch (error) {if (error.code !== 'ENOENT') throw error;}
  let queue = Promise.resolve();
  const persist = async () => {await writeFile(journal + '.tmp', JSON.stringify(state)); await rename(journal + '.tmp', journal);};
  const server = http.createServer((req, res) => {
    // 同一协作方按收到请求的顺序记录接单；业务规则由调用方负责。
    queue = queue.then(async () => {
      try {
        const path = new URL(req.url, 'http://localhost').pathname;
        if (path === '/health' && req.method === 'GET') return send(res, 200, {status:'ok', providers:vendors.map(x=>x.name)});
        const match = /^\/(vendors|control)\/([a-z-]+)\/commands(?:\/([A-Za-z0-9_.-]+))?$/.exec(path);
        if (!match) return send(res, 404, {error:'not_found'});
        const [, kind, provider, suppliedKey] = match;
        const definition = vendors.find(x=>x.name===provider);
        if (!definition) return send(res,404,{error:'provider_not_found'});
        state[provider] ??= {};
        const key = suppliedKey || req.headers['idempotency-key'];
        if (typeof key !== 'string' || !/^[A-Za-z0-9_.-]{1,120}$/.test(key)) return send(res,400,{error:'invalid_key'});
        if (kind === 'control') {
          if (req.headers.authorization !== 'Bearer synthetic-control') return send(res,403,{error:'control_forbidden'});
          if (req.method !== 'PUT' || !suppliedKey) return send(res,405,{error:'method_not_allowed'});
          if (!state[provider][key]) return send(res,404,{error:'unknown_command'});
          const value = await body(req);
          if (!['accepted','completed','rejected','cancelled'].includes(value.status)) return send(res,422,{error:'invalid_status'});
          state[provider][key].status = value.status;
          state[provider][key].result = value.result ?? null;
          state[provider][key].revision++;
          await persist();
          return send(res,200,state[provider][key]);
        }
        if (req.method === 'GET' && suppliedKey) return state[provider][key] ? send(res,200,state[provider][key]) : send(res,404,{error:'unknown_command'});
        if (req.method !== 'POST' || suppliedKey) return send(res,405,{error:'method_not_allowed'});
        const payload = await body(req);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return send(res,422,{error:'object_required'});
        const missing = definition.required.filter(field => !(field in payload));
        if (missing.length) return send(res,422,{error:'missing_fields',fields:missing});
        const fingerprint = digest(payload);
        if (state[provider][key]) {
          if (state[provider][key].fingerprint !== fingerprint) return send(res,409,{error:'key_payload_conflict'});
          return send(res,200,state[provider][key]);
        }
        const record = {key,provider,payload,fingerprint,status:'accepted',result:null,revision:1};
        state[provider][key] = record;
        await persist();
        // 合成通道可模拟接单落盘后丢失响应。
        if (req.headers['x-synthetic-response'] === 'disconnect') {req.socket.destroy(); return;}
        return send(res,202,record);
      } catch (error) {if (!res.destroyed) send(res, error instanceof SyntaxError ? 400 : 500, {error:error instanceof SyntaxError ? 'invalid_json' : 'internal_error'});}
    }).catch(()=>{if(!res.destroyed) send(res,500,{error:'internal_error'});});
  });
  await new Promise((ok, fail)=>{server.once('error',fail);server.listen(port,host,ok);});
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = await startVendor({stateDirectory:process.env.STATE_DIR || '/tmp/vendor-state',port:Number(process.env.PORT || 9090),host:process.env.HOST || '0.0.0.0'});
  console.log(JSON.stringify({message:'协作方联调服务已启动',address:server.address()}));
}
