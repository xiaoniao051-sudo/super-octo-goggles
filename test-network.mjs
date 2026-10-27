import assert from 'node:assert/strict';
import {fetchJson} from './network.js';
const original=globalThis.fetch;
try {
  let signal;
  globalThis.fetch=async(_,options)=>{signal=options.signal;return {ok:true,json:async()=>({ready:true})};};
  assert.deepEqual(await fetchJson('./data.json'),{ready:true});
  assert.equal(signal.aborted,false);
  globalThis.fetch=async()=>({ok:false});
  await assert.rejects(fetchJson('./data.json',{label:'题目'}),/题目暂时无法读取/);
  globalThis.fetch=async(_,options)=>{signal=options.signal;return {ok:true,json:()=>new Promise(()=>{})};};
  await assert.rejects(fetchJson('./data.json',{timeoutMs:10,label:'解析'}),/解析加载超时/);
  assert.equal(signal.aborted,true);
  globalThis.fetch=async()=>({ok:true,json:async()=>({recovered:true})});
  assert.deepEqual(await fetchJson('./data.json'),{recovered:true});
  globalThis.fetch=async()=>({ok:true,json:async()=>{throw new SyntaxError('invalid JSON');}});
  await assert.rejects(fetchJson('./data.json'),SyntaxError);
  console.log('Network: success, HTTP failure, stalled body abort, retry recovery and malformed JSON passed.');
} finally {globalThis.fetch=original;}
