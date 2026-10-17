export const STATE_KEY='guokao-2027-study-v1';
export const emptyStudy=()=>({schema:1,cards:{},scratchpad:'',updatedAt:null});
function validate(state){
 if(!state||state.schema!==1||!state.cards||Array.isArray(state.cards)||typeof state.cards!=='object'||typeof state.scratchpad!=='string'||state.scratchpad.length>200000)throw Error('笔记格式无法识别，原数据未改动');
 for(const[id,item]of Object.entries(state.cards))if(!/^[a-z0-9-]{1,64}$/.test(id)||!item||typeof item.note!=='string'||item.note.length>100000||typeof item.starred!=='boolean'||typeof item.mastered!=='boolean')throw Error('笔记条目格式或长度无效，原数据未改动');
 return state;
}
export function loadStudy(storage){const raw=storage.getItem(STATE_KEY);return raw?validate(JSON.parse(raw)):emptyStudy();}
function commit(storage,state){validate(state);state.updatedAt=new Date().toISOString();try{storage.setItem(STATE_KEY,JSON.stringify(state));}catch{throw Error('设备储存空间不足或浏览器禁止保存，请先备份当前笔记');}return structuredClone(state);}
export function saveCard(storage,id,patch,knownIds){
 if(!knownIds.includes(id))throw Error('找不到知识条目');
 const state=loadStudy(storage),old=state.cards[id]||{note:'',starred:false,mastered:false};
 for(const key of ['note','starred','mastered'])if(patch[key]!==undefined)old[key]=patch[key];
 old.updatedAt=new Date().toISOString();state.cards[id]=old;return commit(storage,state);
}
export function saveScratchpad(storage,text){const state=loadStudy(storage);state.scratchpad=text;return commit(storage,state);}
export function mergeStudy(storage,backup,knownIds){
 validate(backup);const state=loadStudy(storage);let count=0;
 const merge=(a,b)=>!b||a===b?a:!a?b:a+'\n\n【导入备份】\n'+b;
 for(const[id,item]of Object.entries(backup.cards)){if(!knownIds.includes(id))continue;const old=state.cards[id]||{note:'',starred:false,mastered:false};state.cards[id]={note:merge(old.note,item.note),starred:old.starred||item.starred,mastered:old.mastered||item.mastered,updatedAt:new Date().toISOString()};count++;}
 state.scratchpad=merge(state.scratchpad,backup.scratchpad);return {state:commit(storage,state),count};
}
