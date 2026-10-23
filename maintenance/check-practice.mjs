import assert from 'node:assert/strict';
import fs from 'node:fs';
import {adaptSourceQuestion,submissionResult,hasMistake,persistPracticeRound,retryPendingRounds,hasPendingRounds,reconcileNoteDraft} from '../verbal-practice-model.js';
import {loadStudy,saveAnswerNote,recordReviewAttempt,saveCard} from '../storage.js';
import {reviewEvidenceKey,getReviewSummary} from '../review.js';
import {parseVerbalSource,rawSourceUrl} from '../verbal-source-parser.js';
const content=new Map(),storage={getItem:k=>content.get(k)??null,setItem:(k,v)=>content.set(k,v)};
const answers=JSON.parse(fs.readFileSync(new URL('../answers.json',import.meta.url),'utf8')).answers;
const a=answers.find(q=>q.id==='verbal-exercise27-001');
saveCard(storage,'keep-old',{note:'旧笔记保留'},['keep-old']);saveAnswerNote(storage,a.id,{note:'旧错因'});
assert.equal(submissionResult(a,'C').kind,'correct');assert.equal(submissionResult(a,'A').kind,'incorrect');
const now=new Date('2026-10-23T10:00:00+08:00');recordReviewAttempt(storage,a,{selectedOption:'A',attemptId:'attempt-unit-001'},now);recordReviewAttempt(storage,a,{selectedOption:'A',attemptId:'attempt-unit-001'},now);
assert.equal(loadStudy(storage).reviewAttempts[a.id].length,1);assert(hasMistake(a,loadStudy(storage)));
assert.equal(loadStudy(storage).cards['keep-old'].note,'旧笔记保留');assert.equal(loadStudy(storage).answerNotes[a.id].note,'旧错因');
const url='https://github.com/ERRRC/xingcezhenti/blob/main/03-言语理解与表达/测试.md';
const md='试卷: "测试"\n题数: "1"\n年份: "2026"\n## 第 1 题 <sub>qid 1 · 词语选填</sub>\n这是一道自行编写的测试题：一加一等于？\n- **A**. 一\n- **B**. 二 ✅\n- **C**. 三\n- **D**. 四\n**答案**：B\n**官方解析**\n禁止复制的示例解析正文';
const p=parseVerbalSource(md,{sourceUrl:url,expectedCount:1,bindings:[{qid:1,moduleNumber:1,materialGroupId:null}]});assert.equal(p.questions.length,1);assert(p.questions[0].sourceTextComplete);assert(!JSON.stringify(p).includes('禁止复制'));assert(!JSON.stringify(p.questions[0].options).includes('✅'));
const r=adaptSourceQuestion(p.questions[0],{id:'verbal-unit-001',part:'逻辑填空',subtype:'测试'},{moduleNumber:1},{id:'source-test',title:'测试',url,exam:'guokao',year:2026});
assert.equal(submissionResult(r,'A').kind,'reference-different');assert.equal(submissionResult(r,'B').kind,'reference-match');recordReviewAttempt(storage,r,{selectedOption:'A',attemptId:'attempt-unit-002'},now);assert.equal(loadStudy(storage).reviewAttempts[r.id][0].correct,null);assert(hasMistake(r,loadStudy(storage)));assert(!hasMistake({...r,correctOption:'A'},loadStudy(storage)));
assert.throws(()=>rawSourceUrl('javascript:alert(1)'));assert.throws(()=>rawSourceUrl('https://other.example/questions'));
const denied={getItem:storage.getItem,setItem:()=>{throw Error('denied');}};assert.throws(()=>recordReviewAttempt(denied,a,{selectedOption:'C',attemptId:'attempt-unit-003'},now));assert.equal(loadStudy(storage).reviewAttempts[a.id].length,1);
// Same confirmed content in another paper must share evidence and mistake
// history, while the source shown to the learner remains the actual paper.
const secondUrl=url.replace('测试.md','另一试卷.md');
const duplicate=adaptSourceQuestion(p.questions[0],{id:r.id,part:r.part,subtype:r.subtype},{moduleNumber:3},{id:'second-paper',title:'另一试卷',url:secondUrl,exam:'guokao',year:2026,sourceSha:'different-commit'});
assert.equal(reviewEvidenceKey(r),reviewEvidenceKey(duplicate));assert.equal(duplicate.sourceUrl,secondUrl);assert.notEqual(r.sourceUrl,duplicate.sourceUrl);
assert(hasMistake(duplicate,loadStudy(storage)));assert.equal(getReviewSummary([r,duplicate],loadStudy(storage),now).gradedCount,0);
assert.notEqual(reviewEvidenceKey({...duplicate,question:{...duplicate.question,stem:'changed question'}}),reviewEvidenceKey(r));
assert.notEqual(reviewEvidenceKey({...duplicate,question:{...duplicate.question,options:[...duplicate.question.options].reverse()}}),reviewEvidenceKey(r));
// A failed save stays pending; recovery keeps the original ID/time and retries
// idempotently rather than resetting the round or losing it during navigation.
const round={answer:a,choice:'A',attemptId:'attempt-recover-001',at:null,submitted:false,saved:false};
assert.equal(persistPracticeRound(denied,a,round,now).ok,false);assert(hasPendingRounds([round]));
assert.equal(retryPendingRounds(denied,[round]).ok,false);assert.equal(round.at,now);
assert.equal(retryPendingRounds(storage,[round]).ok,true);assert(!hasPendingRounds([round]));
assert.equal(retryPendingRounds(storage,[round]).ok,true);
assert.equal(loadStudy(storage).reviewAttempts[a.id].filter(x=>x.id===round.attemptId).length,1);
assert.equal(loadStudy(storage).reviewAttempts[a.id].find(x=>x.id===round.attemptId).answeredAt,now.toISOString());
assert.equal(loadStudy(storage).cards['keep-old'].note,'旧笔记保留');assert.equal(loadStudy(storage).answerNotes[a.id].note,'旧错因');
// Three-way note merging preserves external updates, edits, and a conflict
// involving an explicit local clear. It does not append unchanged stale text.
assert.deepEqual(reconcileNoteDraft({baseValue:'原笔记',value:'原笔记'},'另一页新笔记'),{value:'另一页新笔记',conflict:false});
const merged=reconcileNoteDraft({baseValue:'原笔记',value:'本页新想法'},'另一页新笔记');
assert(merged.conflict);assert(merged.value.includes('本页新想法'));assert(merged.value.includes('另一页新笔记'));
assert.equal(reconcileNoteDraft({baseValue:'原笔记',value:''},'另一页新笔记').value,'另一页新笔记');
assert.equal(reconcileNoteDraft({baseValue:'原笔记',value:''},'原笔记').value,'');
assert(![...content.values()].some(raw=>raw.includes('这是一道自行编写的测试题')),'Source question text must stay out of device storage');
const bank=JSON.parse(fs.readFileSync(new URL('../verbal-bank.json',import.meta.url),'utf8'));let linked=0;for(const q of bank.items)for(const o of q.occurrences)if(o.materialGroupId){assert(o.moduleNumber<=10);linked++;}assert.equal(linked,80);
console.log(JSON.stringify({result:'passed',storage:'in-memory only',sourceReferenceExcludedFromVerifiedStats:true,sharedPassageBindings:linked,crossPaperMistakesPreserved:true,failedAttemptsRetriedIdempotently:true,concurrentNotesPreserved:true,noFullTextInDeviceStorage:true}));
