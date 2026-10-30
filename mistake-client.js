import {NOTEBOOK_KEY,getNotebook,knownNotebooks,rememberNotebook,recoveryKey,recoveryUrl,isNotebookKey} from './notebook-identity.js?v=20261030-nopass';
const ORIGIN=['localhost','127.0.0.1','[::1]'].includes(location.hostname)?location.origin:'https://guokao-2027-pocket.xiaoniao051.chatgpt.site';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const legacyAttempts=new Set();let pendingImport=null;
export const notebookRecoveryLink=()=>recoveryUrl(getNotebook(localStorage,crypto),location.href);
async function request(query,body,key,token){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{
 const r=await fetch(ORIGIN+'/api/tutor/mistakes'+query,{method:body===undefined?'GET':'POST',credentials:'omit',cache:'no-store',headers:{'X-Notebook-Key':key,...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal});
 const data=await r.json();if(!r.ok){const e=Error(data.error?.message||'操作暂未完成');e.status=r.status;throw e;}return data;
 }catch(e){if(e.status)throw e;throw Error('未能连接云端，尚未确认保存。请检查网络后重试，不会重复收录。');}finally{clearTimeout(timer);}}
async function importLegacy(key){
 const marker='guokao-notebook-imported:'+key;let session;
 try{if(localStorage.getItem(marker)==='1'||legacyAttempts.has(key))return;session=JSON.parse(sessionStorage.getItem('guokao-ai-session-v1'));}catch{return;}
 if(!session?.token||session.expiresAt<=Date.now())return;
 if(!pendingImport)pendingImport=(async()=>{try{await request('',{action:'adopt-legacy'},key,session.token);try{localStorage.setItem(marker,'1');}catch{}}catch(e){if(e.status===401){legacyAttempts.add(key);return;}throw e;}finally{pendingImport=null;}})();
 return pendingImport;
}
export async function mistakeApi(query='',body){const key=getNotebook(localStorage,crypto);await importLegacy(key);return request(query,body,key);}
export async function saveMistake(question,choice=null,note=''){return mistakeApi('',{action:'save',question,choice,note});}
export function createMistakeButton(question,getChoice=()=>null,getNote=()=>'',notify=()=>{}){
 const b=el('button','quiet-btn save-mistake','＋ 加入错题本');b.type='button';b.title='直接保存题目、当前选择和错因，不用输入口令';
 b.onclick=async()=>{b.disabled=true;b.textContent='正在保存…';try{const r=await saveMistake(question,getChoice(),getNote());b.textContent=r.item.state==='archived'?'已在归档中':'✓ 已存入错题本';notify(r.alreadySaved?'已经收录，原来的错因和作答已保留。':'已保存到云端。换设备时用错题本里的专属恢复链接。');const a=el('a','saved-mistake-link','查看这道错题 →');a.href='./mistakes.html?id='+encodeURIComponent(r.item.id);b.nextElementSibling?.classList.contains('saved-mistake-link')&&b.nextElementSibling.remove();b.after(a);}catch(e){b.textContent='＋ 加入错题本';notify(e.message);}finally{b.disabled=false;}};return b;
}
function restorePrompt(key){return new Promise(resolve=>{
 const dialog=el('dialog','mistake-dialog'),h=el('h2','','恢复这个错题本？'),p=el('p','muted','这个链接可以访问对应的云端错题。只打开你自己保存或信任的人发来的链接；当前错题本也会保留在“恢复与换设备”里。'),actions=el('div','bank-actions'),yes=el('button','primary-btn','恢复这个错题本'),no=el('button','quiet-btn','取消'),status=el('p','save-status');yes.type=no.type='button';
 const close=value=>{dialog.close();dialog.remove();resolve(value);};yes.onclick=()=>{try{rememberNotebook(localStorage,key);close(true);}catch(e){status.textContent=e.message;}};no.onclick=()=>close(false);dialog.addEventListener('cancel',e=>{e.preventDefault();close(false);});actions.append(yes,no);dialog.append(h,p,status,actions);document.body.append(dialog);dialog.showModal();
});}
export async function acceptNotebookRecovery(){
 if(!location.hash.startsWith('#notebook='))return false;
 const key=recoveryKey(location.href),clean=new URL(location.href);clean.hash='';history.replaceState(null,'',clean);
 if(!isNotebookKey(key))throw Error('恢复链接不完整，请重新复制。');
 if(localStorage.getItem(NOTEBOOK_KEY)===key)return true;
 return restorePrompt(key);
}
export function showNotebookRecovery(){
 const dialog=el('dialog','mistake-dialog'),title=el('h2','','恢复与换设备'),desc=el('p','muted','把专属链接保存到备忘录，换设备或清理微信缓存后，用它打开同一个错题本。拿到链接的人也能查看和修改记录，请妥善保管。'),field=el('textarea','mistake-note-field'),actions=el('div','bank-actions'),copy=el('button','primary-btn','复制专属恢复链接'),close=el('button','quiet-btn','关闭'),status=el('p','save-status');
 field.readOnly=true;field.setAttribute('aria-label','专属恢复链接');field.value=notebookRecoveryLink();copy.type=close.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(field.value);status.textContent='已复制，请保存到自己的备忘录。';}catch{field.focus();field.select();status.textContent='请长按上方链接复制。';}};close.onclick=()=>{dialog.close();dialog.remove();};dialog.addEventListener('cancel',()=>dialog.remove());actions.append(copy,close);dialog.append(title,desc,field,status,actions);
 const current=getNotebook(localStorage,crypto),others=knownNotebooks(localStorage).filter(r=>r.key!==current);if(others.length){dialog.append(el('h3','','这个浏览器以前用过的错题本'));for(const row of others){const b=el('button','quiet-btn','切回 '+new Date(row.at).toLocaleDateString('zh-CN')+' 的错题本');b.type='button';b.onclick=async()=>{close.click();if(await restorePrompt(row.key)){location.href='./mistakes.html';}};dialog.append(b);}}
 document.body.append(dialog);dialog.showModal();
}
