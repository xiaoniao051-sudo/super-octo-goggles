const ORIGIN=['localhost','127.0.0.1','[::1]'].includes(location.hostname)?location.origin:'https://guokao-2027-pocket.xiaoniao051.chatgpt.site';
const KEY='guokao-ai-session-v1';
let memorySession=null,loginPromise=null;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const readSession=()=>{try{return JSON.parse(sessionStorage.getItem(KEY))||memorySession;}catch{return memorySession;}};
export function clearStudySession(){memorySession=null;try{sessionStorage.removeItem(KEY);}catch{}}
async function request(path,body,token){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{
 const r=await fetch(ORIGIN+'/api/tutor/'+path,{method:body===undefined?'GET':'POST',credentials:'omit',cache:'no-store',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal});
 const data=await r.json();if(!r.ok){const e=Error(data.error?.message||'操作暂未完成');e.status=r.status;throw e;}return data;
 }catch(e){if(e.status)throw e;throw Error('未能连接云端，尚未确认保存。请检查网络后重试，不会重复收录。');}finally{clearTimeout(timer);}}
export function studyLogin(){
 const existing=readSession();if(existing?.token&&existing.expiresAt>Date.now())return Promise.resolve(existing);
 if(loginPromise)return loginPromise;
 loginPromise=new Promise((resolve,reject)=>{
  const previous=document.activeElement,dialog=el('dialog','mistake-dialog'),form=el('form'),title=el('h2','','打开云端错题本'),desc=el('p','muted','使用与 AI 答疑相同的口令。持有口令的人共用这个错题本；保存不会消耗 AI 额度。'),label=el('label','','访问口令'),input=el('input'),status=el('p','save-status'),actions=el('div','bank-actions'),submit=el('button','primary-btn','确认'),cancel=el('button','quiet-btn','取消');
  input.type='password';input.autocomplete='current-password';input.required=true;input.maxLength=200;label.append(input);submit.type='submit';cancel.type='button';status.setAttribute('role','status');actions.append(submit,cancel);form.append(title,desc,label,status,actions);dialog.append(form);document.body.append(dialog);
  let settled=false;const finish=(value,error)=>{if(settled)return;settled=true;dialog.close();dialog.remove();previous?.focus();loginPromise=null;error?reject(error):resolve(value);};
  cancel.onclick=()=>finish(null,Error('已取消，题目尚未保存到云端。'));dialog.addEventListener('cancel',e=>{e.preventDefault();cancel.click();});
  form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;status.textContent='正在验证…';try{const s=await request('study-login',{passphrase:input.value});input.value='';memorySession=s;try{sessionStorage.setItem(KEY,JSON.stringify(s));}catch{}finish(s);}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}};
  dialog.showModal();input.focus();
 });return loginPromise;
}
export async function mistakeApi(query='',body){const s=await studyLogin();try{return await request('mistakes'+query,body,s.token);}catch(e){if(e.status===401)clearStudySession();throw e;}}
export async function saveMistake(question,choice=null,note=''){return mistakeApi('',{action:'save',question,choice,note});}
export function createMistakeButton(question,getChoice=()=>null,getNote=()=>'',notify=()=>{}){
 const b=el('button','quiet-btn save-mistake','＋ 加入错题本');b.type='button';b.title='把完整题目、当前选择和错因存到云端';
 b.onclick=async()=>{b.disabled=true;b.textContent='正在保存…';try{const r=await saveMistake(question,getChoice(),getNote());b.textContent=r.item.state==='archived'?'已在归档中':'✓ 已存入错题本';notify(r.alreadySaved?'已经收录，原来的错因和作答已保留。':'已保存到云端错题本，换设备也能查看。');const a=el('a','saved-mistake-link','查看这道错题 →');a.href='./mistakes.html?id='+encodeURIComponent(r.item.id);b.nextElementSibling?.classList.contains('saved-mistake-link')&&b.nextElementSibling.remove();b.after(a);}catch(e){b.textContent='＋ 加入错题本';notify(e.message);}finally{b.disabled=false;}};return b;
}
