import {gradeAnswer,reviewEvidenceKey,localDate,compareAttempts} from './review.js?v=20261020-review2';

// Keep the existing key: changing it would strand notes on this browser.
export const STATE_KEY='guokao-2027-study-v1';
export const emptyStudy=()=>({schema:2,cards:{},scratchpad:'',questions:{},answerNotes:{},questionDraft:null,reviewAttempts:{},updatedAt:null});
const SEPARATOR='\n\n【导入备份】\n';
const unsafeKeys=new Set(['__proto__','prototype','constructor']);
const questionId=/^qa-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const entryId=/^[a-z0-9-]{1,64}$/;
const attemptId=/^attempt-[a-z0-9-]{1,56}$/;
const questionLimits={paper:200,number:40,subject:100,source:500,myAnswer:500,doubt:5000,stem:30000,note:100000};
const draftKeys=['paper','number','subject','source','myAnswer','doubt','stem'];
const identityKeys=['paper','number','subject','source'];
const invalid=()=>Error('笔记格式或长度无效，原数据未改动');
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
function safeRecord(value){if(!record(value)||Object.keys(value).some(key=>unsafeKeys.has(key)))throw invalid();return value;}
function text(value,limit,required=false){if(typeof value!=='string'||value.length>limit||(required&&!value.trim()))throw invalid();return value;}
function bool(value){if(typeof value!=='boolean')throw invalid();return value;}
function time(value,nullable=false){if(nullable&&value==null)return null;return text(value,64,true);}
function safeId(id,pattern=entryId){if(typeof id!=='string'||!pattern.test(id)||unsafeKeys.has(id))throw invalid();return id;}
function normalizeDraft(draft){if(draft==null)return null;safeRecord(draft);const result={};for(const key of draftKeys)result[key]=text(draft[key],questionLimits[key]);return result;}
function normalizeQuestion(item){
 safeRecord(item);const result={};
 for(const[key,limit]of Object.entries(questionLimits))result[key]=text(item[key],limit,['paper','number'].includes(key));
 result.mastered=bool(item.mastered);result.createdAt=time(item.createdAt);result.updatedAt=time(item.updatedAt);return result;
}
function normalizeAttempt(item){
 safeRecord(item);
 const id=safeId(item.id,attemptId),selectedOption=text(item.selectedOption,1,true),answeredAt=text(item.answeredAt,64,true),date=text(item.localDate,10,true);
 if(!/^[A-H]$/.test(selectedOption)||![null,'sure','unsure','guess'].includes(item.confidence)||!(item.correct===null||typeof item.correct==='boolean'))throw invalid();
 const instant=new Date(answeredAt);
 if(!Number.isFinite(instant.getTime())||instant.toISOString()!==answeredAt||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw invalid();
 const calendar=new Date(date+'T12:00:00.000Z');
 if(!Number.isFinite(calendar.getTime())||calendar.toISOString().slice(0,10)!==date)throw invalid();
 if(typeof item.evidenceKey!=='string'||!/^rv1-[a-f0-9]{32}$/.test(item.evidenceKey))throw invalid();
 return {id,selectedOption,confidence:item.confidence,answeredAt,localDate:date,correct:item.correct,evidenceKey:item.evidenceKey};
}
function validate(state){
 safeRecord(state);if(![1,2].includes(state.schema))throw invalid();safeRecord(state.cards);
 const clean=emptyStudy();clean.scratchpad=text(state.scratchpad,200000);clean.updatedAt=time(state.updatedAt,true);
 for(const[id,item]of Object.entries(state.cards)){
  safeId(id);safeRecord(item);const card={note:text(item.note,100000),starred:bool(item.starred),mastered:bool(item.mastered)};
  if(item.updatedAt!==undefined)card.updatedAt=time(item.updatedAt);clean.cards[id]=card;
 }
 if(state.questions!==undefined){safeRecord(state.questions);for(const[id,item]of Object.entries(state.questions)){safeId(id,questionId);clean.questions[id]=normalizeQuestion(item);}}
 if(state.answerNotes!==undefined){safeRecord(state.answerNotes);for(const[id,item]of Object.entries(state.answerNotes)){safeId(id);safeRecord(item);clean.answerNotes[id]={note:text(item.note,100000),mastered:bool(item.mastered),updatedAt:time(item.updatedAt)};}}
 if(state.questionDraft!==undefined)clean.questionDraft=normalizeDraft(state.questionDraft);
 // Schema 1 did not contain answer attempts. Mastery flags remain subjective.
 if(state.schema===2){
  safeRecord(state.reviewAttempts);
  for(const[id,items]of Object.entries(state.reviewAttempts)){
   safeId(id);if(!Array.isArray(items))throw invalid();
   const unique=new Map();
   for(const item of items){const attempt=normalizeAttempt(item),existing=unique.get(attempt.id);if(existing&&JSON.stringify(existing)!==JSON.stringify(attempt))throw invalid();unique.set(attempt.id,attempt);}
   clean.reviewAttempts[id]=[...unique.values()].sort(compareAttempts);
  }
 }
 return clean;
}
export function loadStudy(storage){const raw=storage.getItem(STATE_KEY);return raw?validate(JSON.parse(raw)):emptyStudy();}
function commit(storage,state){const clean=validate(state);clean.updatedAt=new Date().toISOString();try{storage.setItem(STATE_KEY,JSON.stringify(clean));}catch{throw Error('设备储存空间不足或浏览器禁止保存，请先备份当前笔记');}return structuredClone(clean);}
export function saveCard(storage,id,patch,knownIds){
 safeId(id);safeRecord(patch);if(!knownIds.includes(id))throw Error('找不到知识条目');
 const state=loadStudy(storage),old=state.cards[id]||{note:'',starred:false,mastered:false};
 for(const key of ['note','starred','mastered'])if(patch[key]!==undefined)old[key]=patch[key];
 old.updatedAt=new Date().toISOString();state.cards[id]=old;return commit(storage,state);
}
export function saveScratchpad(storage,value){const state=loadStudy(storage);state.scratchpad=value;return commit(storage,state);}
export function saveQuestion(storage,id,patch){
 safeId(id,questionId);safeRecord(patch);const state=loadStudy(storage),existing=state.questions[id],now=new Date().toISOString();
 if(existing)for(const key of identityKeys)if(patch[key]!==undefined&&patch[key]!==existing[key])throw Error('试卷、题号、科目和来源用于关联解析，不能修改；请另存为新题目');
 const item=existing||{paper:'',number:'',subject:'行测',source:'',myAnswer:'',doubt:'',stem:'',note:'',mastered:false,createdAt:now,updatedAt:now};
 for(const key of [...Object.keys(questionLimits),'mastered'])if(patch[key]!==undefined)item[key]=patch[key];
 item.updatedAt=now;state.questions[id]=item;return commit(storage,state);
}
export function saveAnswerNote(storage,id,patch){
 safeId(id);safeRecord(patch);const state=loadStudy(storage),item=state.answerNotes[id]||{note:'',mastered:false};
 for(const key of ['note','mastered'])if(patch[key]!==undefined)item[key]=patch[key];
 item.updatedAt=new Date().toISOString();state.answerNotes[id]=item;return commit(storage,state);
}
export function saveQuestionDraft(storage,draft){const state=loadStudy(storage);state.questionDraft=normalizeDraft(draft);return commit(storage,state);}
export function recordReviewAttempt(storage,answer,selection,now=new Date()){
 safeId(answer?.id);safeRecord(selection);
 if(!Array.isArray(answer.question?.options)||!answer.question.options.some(o=>o&&o.label===selection.selectedOption))throw Error('请先选择题目中的一个选项');
 const id=selection.attemptId||'attempt-'+crypto.randomUUID();
 const item=normalizeAttempt({id,selectedOption:selection.selectedOption,confidence:selection.confidence??null,answeredAt:now.toISOString(),localDate:localDate(now),correct:gradeAnswer(answer,selection.selectedOption),evidenceKey:reviewEvidenceKey(answer)});
 const state=loadStudy(storage),items=state.reviewAttempts[answer.id]||[],existing=items.find(a=>a.id===id);
 if(existing){
  if(existing.selectedOption!==item.selectedOption||existing.confidence!==item.confidence||existing.evidenceKey!==item.evidenceKey)throw Error('本次作答已保存，请重新开始一次重做');
  return state;
 }
 state.reviewAttempts[answer.id]=[...items,item];return commit(storage,state);
}
function mergeText(a,b){if(!b||a===b)return a;if(!a)return b;const parts=a.split(SEPARATOR);for(const part of b.split(SEPARATOR))if(part&&!parts.includes(part))parts.push(part);return parts.join(SEPARATOR);}
const identity=item=>JSON.stringify(identityKeys.map(key=>item[key]));
// Stable local IDs prevent the same conflicting backup from creating repeated copies.
function conflictId(id,item,attempt){
 const input=JSON.stringify([id,identity(item),attempt]);let hex='';
 for(const seed of [0x811c9dc5,0x9e3779b9,0x85ebca6b,0xc2b2ae35]){let hash=seed;for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,0x01000193);}hex+=(hash>>>0).toString(16).padStart(8,'0');}
 return 'qa-'+hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
}
function mergeQuestion(a,b,now){
 if(!a)return {...b};const merged={...a};
 for(const key of ['myAnswer','doubt','stem','note'])merged[key]=mergeText(a[key],b[key]);
 merged.mastered=a.mastered||b.mastered;merged.updatedAt=now;return merged;
}
export function mergeStudy(storage,backup,knownIds){
 const incoming=validate(backup),state=loadStudy(storage),now=new Date().toISOString();let count=0,questionCount=0,answerNoteCount=0,reviewAttemptCount=0;const conflicts=[],reviewConflicts=[],warnings=[];
 for(const[id,item]of Object.entries(incoming.cards)){
  if(!knownIds.includes(id))continue;const old=state.cards[id]||{note:'',starred:false,mastered:false};
  state.cards[id]={note:mergeText(old.note,item.note),starred:old.starred||item.starred,mastered:old.mastered||item.mastered,updatedAt:now};count++;
 }
 for(const[id,item]of Object.entries(incoming.questions)){
  let targetId=id;
  if(state.questions[id]&&identity(state.questions[id])!==identity(item)){
   let attempt=0;do{targetId=conflictId(id,item,attempt++);}while(state.questions[targetId]&&identity(state.questions[targetId])!==identity(item));
   conflicts.push({originalId:id,importedId:targetId,paper:item.paper,number:item.number});
   warnings.push('同一答疑编号对应不同试卷信息，已另存为 '+targetId+'；后续发送问题请使用新编号。');
  }
  state.questions[targetId]=mergeQuestion(state.questions[targetId],item,now);questionCount++;
 }
 for(const[id,item]of Object.entries(incoming.answerNotes)){
  const old=state.answerNotes[id]||{note:'',mastered:false};state.answerNotes[id]={note:mergeText(old.note,item.note),mastered:old.mastered||item.mastered,updatedAt:now};answerNoteCount++;
 }
 for(const[id,items]of Object.entries(incoming.reviewAttempts)){
  const combined=new Map((state.reviewAttempts[id]||[]).map(a=>[a.id,a]));
  for(const item of items){
   let next=item,existing=combined.get(item.id);
   if(existing&&JSON.stringify(existing)!==JSON.stringify(item)){
    let attempt=0;
    do{
     const synthetic=conflictId(item.id,{paper:JSON.stringify(item),number:id,subject:String(attempt++),source:''},0);
     next={...item,id:'attempt-import-'+synthetic.slice(3)};
     existing=combined.get(next.id);
    }while(existing&&JSON.stringify(existing)!==JSON.stringify(next));
    reviewConflicts.push({answerId:id,originalId:item.id,importedId:next.id});
    warnings.push('同一作答编号包含不同记录，已完整另存，原记录未覆盖：'+id+'。');
   }
   combined.set(next.id,next);reviewAttemptCount++;
  }
  state.reviewAttempts[id]=[...combined.values()].sort(compareAttempts);
 }
 state.scratchpad=mergeText(state.scratchpad,incoming.scratchpad);
 if(incoming.questionDraft){
  if(!state.questionDraft)state.questionDraft=incoming.questionDraft;
  else if(JSON.stringify(draftKeys.map(k=>state.questionDraft[k]))!==JSON.stringify(draftKeys.map(k=>incoming.questionDraft[k]))){
   const labels={paper:'试卷',number:'题号',subject:'科目',source:'来源',myAnswer:'我的作答',doubt:'我的疑问',stem:'题干与选项'};
   const preserved='【导入的未完成题目草稿】\n'+draftKeys.map(k=>labels[k]+'：'+incoming.questionDraft[k]).join('\n');
   state.scratchpad=mergeText(state.scratchpad,preserved);warnings.push('当前草稿已保留，备份中的另一份题目草稿已完整保存到随手记。');
  }
 }
 return {state:commit(storage,state),count,totalCount:count+questionCount+answerNoteCount+reviewAttemptCount,questionCount,answerNoteCount,reviewAttemptCount,conflicts,reviewConflicts,warnings};
}
