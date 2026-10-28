import {gradeAnswer,reviewEvidenceKey} from './review.js?v=20261020-review2';
import {recordReviewAttempt} from './storage.js?v=20261020-review2';
export const segmentText=segments=>(segments||[]).map(s=>s.type==='image'?'[图片 '+s.url+']':s.text).join('\n');
const evidenceText=value=>String(value).replace(/\s+/g,' ').trim();
export function adaptSourceQuestion(parsed,item,occurrence,paper){
 const stem=[parsed.material?segmentText(parsed.material.segments):'',segmentText(parsed.stem)].filter(Boolean).join('\n\n');
 // The displayed occurrence may change while the verified identical content does
 // not. Keep its URL outside the evidence object; content/key changes still
 // invalidate grading, and the full question remains in memory only.
 return {id:item.id,paper:paper.title,number:String(occurrence.originalNumber||occurrence.moduleNumber),part:item.part,subtype:item.subtype,exam:paper.exam,year:paper.year,sourceOnly:true,paperId:paper.id,sourceQid:parsed.qid,sourceUrl:paper.url,displayStem:parsed.stem,displayMaterial:parsed.material?.segments||[],displayOptions:parsed.options,question:{stem:evidenceText(stem),prompt:'',options:parsed.options.map(o=>({label:o.label,text:evidenceText(segmentText(o.segments))})),versionNote:'来源言语模块序号；未核官方原卷。',sourceUrl:''},correctOption:parsed.referenceAnswer?.value||null,verification:{status:'pending',note:'答案来自公开回忆版，尚未逐题独立核验；不计入本站已核对正确率。'},sourceVersion:'verbal-content-v2:'+String(item.contentHash||item.id)+':'+String(item.materialHash||'none'),sections:[]};
}
export function submissionResult(answer,choice){
 const correct=gradeAnswer(answer,choice);
 if(typeof correct==='boolean')return {kind:correct?'correct':'incorrect',correct,reference:false};
 if(answer.sourceOnly&&answer.explanation?.status==='disputed')return {kind:'disputed',correct:null,reference:false};
 if(answer.sourceOnly&&answer.correctOption&&answer.question.options.some(o=>o.label===answer.correctOption))return {kind:choice===answer.correctOption?'reference-match':'reference-different',correct:null,reference:true};
 return {kind:'ungraded',correct:null,reference:false};
}
export function currentAttempts(answer,study){return (study.reviewAttempts?.[answer.id]||[]).filter(a=>a.evidenceKey===reviewEvidenceKey(answer)&&answer.question.options.some(o=>o.label===a.selectedOption)&&a.correct===gradeAnswer(answer,a.selectedOption));}
export function hasMistake(answer,study){return currentAttempts(answer,study).some(a=>['incorrect','reference-different'].includes(submissionResult(answer,a.selectedOption).kind));}
export function plainQuestion(answer){return [answer.paper+' · '+(answer.sourceOnly?'言语模块第 ':'第 ')+answer.number+' 题',answer.question.stem,answer.question.prompt,...answer.question.options.map(o=>o.label+'. '+o.text),answer.sourceUrl?'当前原题来源：'+answer.sourceUrl:''].filter(Boolean).join('\n');}

// A round keeps its ID/time and answer object through storage errors. Neither
// retries nor navigation may replace it before the attempt is committed.
export function persistPracticeRound(storage,answer,round,now=new Date()){
 if(!round.choice)return {ok:false,state:null};
 round.answer=round.answer||answer;round.at=round.at||now;round.submitted=true;
 try{const state=recordReviewAttempt(storage,round.answer,{selectedOption:round.choice,attemptId:round.attemptId},round.at);round.saved=true;round.error='';return {ok:true,state};}
 catch(e){round.saved=false;round.error=e.message;return {ok:false,state:null};}
}
export function retryPendingRounds(storage,rounds){
 let state=null;const failures=[];
 for(const round of rounds)if(round.submitted&&!round.saved){const result=persistPracticeRound(storage,round.answer,round);if(result.ok)state=result.state;else failures.push(round);}
 return {ok:failures.length===0,state,failures};
}
export function hasPendingRounds(rounds){return [...rounds].some(r=>r.submitted&&!r.saved);}

// Three-way merge: an unchanged editor must not overwrite a newer note, and
// simultaneous edits retain both versions rather than silently choosing one.
export function reconcileNoteDraft(draft,current){
 const base=draft.baseValue||'',value=draft.value||'',latest=current||'';
 if(value===base)return {value:latest,conflict:false};
 if(latest===base||latest===value)return {value,conflict:false};
 if(!value)return {value:latest,conflict:true};
 if(!latest)return {value,conflict:true};
 return {value:latest+'\n\n【另一页面也修改了笔记，以下保留本页草稿】\n'+value,conflict:true};
}
