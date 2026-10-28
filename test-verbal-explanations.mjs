import test from 'node:test';
import assert from 'node:assert/strict';
import {createExplanationIndex,explanationEvidenceKey,withExplanation} from './verbal-explanations.js';
import {reviewEvidenceKey,gradeAnswer} from './review.js';
import {submissionResult,hasMistake} from './verbal-practice-model.js';
import {loadStudy,saveAnswerNote,recordReviewAttempt} from './storage.js';
const question={id:'verbal-test',sourceOnly:true,sourceVersion:'version-1',paper:'甲卷',number:'1',question:{stem:'原创测试题',prompt:'选正确项',options:['A','B','C','D'].map(label=>({label,text:label}))},correctOption:'B',verification:{status:'pending',note:'来源参考'}};
const record={id:question.id,evidenceKey:explanationEvidenceKey(question),answer:'B',status:'explained',reason:'依据题面作具体判断。',distractors:{A:'甲与条件不同',C:'丙扩大了范围',D:'丁颠倒了顺序'},tip:'先看所问，再比较限制条件。',caution:''};
const index=r=>createExplanationIndex({schemaVersion:1,explanations:[r]});
test('explanations bind exact question, ordered options, source key and version',()=>{
 assert(withExplanation(question,index(record)).sections.length>=5);
 for(const changed of [{...question,correctOption:'A'},{...question,sourceVersion:'version-2'},{...question,question:{...question.question,stem:'题面被改'}},{...question,question:{...question.question,options:[...question.question.options].reverse()}}])assert.equal(withExplanation(changed,index(record)).explanation,undefined);
 assert.equal(withExplanation({...question,paper:'乙卷',number:'8'},index(record)).explanation,record);
});
test('new rationale preserves evidence, old wrong attempts and notes without promoting source grading',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 saveAnswerNote(storage,question.id,{note:'此前写下的错因'});
 recordReviewAttempt(storage,question,{selectedOption:'A',attemptId:'attempt-explanation-001'},new Date('2026-10-27T10:00:00Z'));
 const enriched=withExplanation(question,index(record));
 assert.equal(reviewEvidenceKey(enriched),reviewEvidenceKey(question));assert.equal(gradeAnswer(enriched,'B'),null);assert.equal(submissionResult(enriched,'A').kind,'reference-different');assert(hasMistake(enriched,loadStudy(storage)));
 assert.equal(loadStudy(storage).answerNotes[question.id].note,'此前写下的错因');assert.equal(loadStudy(storage).reviewAttempts[question.id][0].correct,null);
 assert(![...values.values()].some(v=>v.includes('原创测试题')||v.includes('依据题面')));
});
test('disputed explanations retain both answer keys and never call a differing choice wrong',()=>{
 const disputed={...record,answer:'A',status:'disputed',distractors:{B:'来源认为此项更好，但有竞争解释',C:'范围过大',D:'顺序倒置'},caution:'本站倾向A，来源为B，需要比较两种依据。'};
 const enriched=withExplanation(question,index(disputed));assert.equal(enriched.correctOption,'B');assert.equal(enriched.explanation.answer,'A');
 for(const choice of ['A','B','C','D']){assert.equal(submissionResult(enriched,choice).kind,'disputed');assert.equal(gradeAnswer(enriched,choice),null);}
});
test('malformed, duplicate and incomplete explanation records are rejected',()=>{
 assert.throws(()=>index({...record,distractors:{A:'缺少其他选项'}}));assert.throws(()=>index({...record,status:'disputed'}));assert.throws(()=>index({...record,reason:''}));assert.throws(()=>createExplanationIndex({schemaVersion:1,explanations:[record,record]}));
});
