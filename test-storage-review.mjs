import test from 'node:test';
import assert from 'node:assert/strict';
import {STATE_KEY,emptyStudy,loadStudy,saveCard,saveScratchpad,saveQuestion,saveAnswerNote,saveQuestionDraft,recordReviewAttempt,mergeStudy} from './storage.js';
import {getVerification,gradeAnswer,localDate,reviewProgress,getReviewSummary,reviewEvidenceKey} from './review.js';

const memory=initial=>{
 const values=new Map(initial?[[STATE_KEY,JSON.stringify(initial)]]:[]);
 return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
};
const answer=()=>({
 id:'example-01',paper:'测试卷',number:'1',reviewedAt:'2026-10-20',sourceVersion:'测试固定版本',
 question:{stem:'请选择合适的一项。',prompt:'哪项符合条件？',options:[{label:'A',text:'第一项'},{label:'B',text:'第二项'}]},
 answer:'这是自由文本，不可用来提取答案。',correctOption:'B',verification:{status:'checked',note:'仅使用当前明确的参考答案'}
});
const day=(year,month,date)=>new Date(year,month-1,date,12);
const at=(storage,a,date,choice='B',extra={})=>recordReviewAttempt(storage,a,{selectedOption:choice,confidence:null,...extra},date);
const qaId='qa-12345678-1234-4234-8234-123456789abc';
const legacy=()=>({
 schema:1,cards:{'card-01':{note:'原来的知识笔记',starred:true,mastered:true}},
 scratchpad:'我的随手记',updatedAt:'2026-10-19T12:00:00.000Z',
 questions:{[qaId]:{paper:'我自己的试卷',number:'1',subject:'行测',source:'',myAnswer:'旧的自由文本 B',doubt:'我的疑问',stem:'私人题面',note:'原来的临时题笔记',mastered:true,createdAt:'2026-10-18T12:00:00.000Z',updatedAt:'2026-10-19T12:00:00.000Z'}},
 answerNotes:{'example-01':{note:'原来的复盘',mastered:true,updatedAt:'2026-10-19T12:00:00.000Z'}},
 questionDraft:{paper:'草稿卷',number:'',subject:'行测',source:'',myAnswer:'',doubt:'尚未完成',stem:''}
});

test('schema 1 loads without rewriting or fabricating attempts; next save migrates in place',()=>{
 const old=legacy(),storage=memory(old),raw=storage.getItem(STATE_KEY),loaded=loadStudy(storage);
 assert.equal(loaded.schema,2);assert.deepEqual(loaded.reviewAttempts,{});
 assert.equal(storage.getItem(STATE_KEY),raw);
 for(const field of ['cards','questions','answerNotes','questionDraft','scratchpad'])assert.deepEqual(loaded[field],old[field]);
 const summary=getReviewSummary([answer()],loaded,day(2026,10,20));
 assert.equal(summary.due.length,0);assert.equal(summary.newItems.length,1);assert.equal(summary.passedCount,0);assert.equal(summary.gradedCount,0);
 saveScratchpad(storage,'新的随手记');
 assert.equal(JSON.parse(storage.getItem(STATE_KEY)).schema,2);
 assert.deepEqual(loadStudy(storage).cards,old.cards);
 assert.deepEqual(loadStudy(storage).answerNotes,old.answerNotes);
});

test('legacy knowledge-only backup remains importable and leaves local questions/notes/drafts intact',()=>{
 const storage=memory(legacy());
 const restored=mergeStudy(storage,{schema:1,cards:{'card-01':{note:'备份知识笔记',starred:false,mastered:false}},scratchpad:'备份随手记'},['card-01']).state;
 assert.match(restored.cards['card-01'].note,/原来的知识笔记[\s\S]*备份知识笔记/);
 assert.equal(restored.cards['card-01'].starred,true);assert.equal(restored.cards['card-01'].mastered,true);
 assert.deepEqual(restored.questions,legacy().questions);assert.deepEqual(restored.answerNotes,legacy().answerNotes);
 assert.deepEqual(restored.questionDraft,legacy().questionDraft);assert.deepEqual(restored.reviewAttempts,{});
});

test('attempt capture preserves subjective mastery and notes; confidence is optional',()=>{
 const storage=memory(legacy()),a=answer(),date=day(2026,10,20);
 const state=recordReviewAttempt(storage,a,{selectedOption:'A'},date),attempt=state.reviewAttempts[a.id][0];
 assert.equal(attempt.selectedOption,'A');assert.equal(attempt.correct,false);assert.equal(attempt.confidence,null);
 assert.equal(attempt.answeredAt,date.toISOString());assert.equal(attempt.localDate,localDate(date));assert.equal(attempt.evidenceKey,reviewEvidenceKey(a));
 assert.deepEqual(state.cards,legacy().cards);assert.deepEqual(state.questions,legacy().questions);
 assert.deepEqual(state.answerNotes,legacy().answerNotes);assert.deepEqual(state.questionDraft,legacy().questionDraft);
 assert.equal(reviewProgress(a,state,date).passed,false);
});

test('only checked explicit structure may grade; never infer an answer from text',()=>{
 const a=answer();
 assert.equal(gradeAnswer(a,'B'),true);assert.equal(gradeAnswer(a,'A'),false);assert.equal(gradeAnswer(a,'C'),null);
 for(const status of ['pending','incomplete','disputed']){
  const pending={...a,verification:{status,note:'仍待核对'}};
  assert.equal(getVerification(pending).canGrade,false);assert.equal(gradeAnswer(pending,'B'),null);
 }
 for(const changed of [
  {...a,verification:undefined},
  {...a,correctOption:undefined,answer:'官方答案：B'},
  {...a,correctOption:'Z'},
  {...a,question:{...a.question,options:['A. 第一项','B. 第二项']}},
  {...a,question:{...a.question,options:[{label:'B',text:'第一项'},{label:'B',text:'第二项'}]}},
  {...a,question:undefined}
 ]){assert.equal(getVerification(changed).canGrade,false);assert.equal(gradeAnswer(changed,'B'),null);}
});

test('pending choices are recorded without judgment, due date, mastery, or accuracy credit',()=>{
 const a={...answer(),verification:{status:'disputed',note:'A/B 有争议'}},storage=memory();
 const state=at(storage,a,day(2026,10,20),'B',{confidence:'guess'}),summary=getReviewSummary([a],state,day(2026,10,21));
 assert.equal(state.reviewAttempts[a.id][0].correct,null);assert.equal(state.reviewAttempts[a.id][0].confidence,'guess');
 assert.equal(summary.paused.length,1);assert.equal(summary.due.length,0);assert.equal(summary.gradedCount,0);assert.equal(summary.correctCount,0);
 assert.equal(reviewProgress(a,state).dueDate,null);assert.equal(reviewProgress(a,state).passed,false);
});

test('calendar intervals progress 1/3/7/14 days and errors reset to tomorrow',()=>{
 const a=answer(),storage=memory();
 let state=at(storage,a,day(2026,10,20));
 assert.deepEqual([reviewProgress(a,state).stage,reviewProgress(a,state).dueDate],[1,'2026-10-21']);
 state=at(storage,a,day(2026,10,21));
 assert.deepEqual([reviewProgress(a,state).stage,reviewProgress(a,state).dueDate],[2,'2026-10-24']);
 state=at(storage,a,day(2026,10,24));
 assert.deepEqual([reviewProgress(a,state).stage,reviewProgress(a,state).dueDate],[3,'2026-10-31']);
 state=at(storage,a,day(2026,10,31));
 assert.deepEqual([reviewProgress(a,state).stage,reviewProgress(a,state).dueDate],[4,'2026-11-14']);
 state=at(storage,a,day(2026,11,14));
 assert.deepEqual([reviewProgress(a,state).stage,reviewProgress(a,state).dueDate],[4,'2026-11-28']);
 state=at(storage,a,day(2026,11,28),'A');
 assert.deepEqual([reviewProgress(a,state).stage,reviewProgress(a,state).dueDate,reviewProgress(a,state).passed],[0,'2026-11-29',false]);
 state=at(storage,a,day(2026,11,29));
 assert.deepEqual([reviewProgress(a,state).stage,reviewProgress(a,state).dueDate],[1,'2026-11-30']);
});

test('same-day drills do not skip spaced intervals; mistakes still reset the interval',()=>{
 const a=answer(),storage=memory(),date=day(2026,10,20);
 at(storage,a,date);
 for(let minute=1;minute<=5;minute++)at(storage,a,new Date(date.getTime()+minute*60000));
 assert.equal(reviewProgress(a,loadStudy(storage)).stage,1);
 at(storage,a,new Date(date.getTime()+6*60000),'A');
 assert.equal(reviewProgress(a,loadStudy(storage)).stage,0);
 at(storage,a,new Date(date.getTime()+7*60000));
 assert.equal(reviewProgress(a,loadStudy(storage)).stage,1);
});

test('new questions and 187 old mastery marks are not overdue; due/scheduled are separate',()=>{
 const a=answer(),b={...answer(),id:'example-02'},study=emptyStudy(),storage=memory(study);
 study.cards=Object.fromEntries(Array.from({length:187},(_,i)=>['card-'+i,{note:'',mastered:true,starred:false}]));
 assert.equal(getReviewSummary([a,b],study,day(2026,10,20)).due.length,0);
 assert.equal(getReviewSummary([a,b],study,day(2026,10,20)).newItems.length,2);
 at(storage,a,day(2026,10,20));
 const before=getReviewSummary([a,b],loadStudy(storage),day(2026,10,20)),due=getReviewSummary([a,b],loadStudy(storage),day(2026,10,21));
 assert.deepEqual(before.scheduled.map(x=>x.id),[a.id]);assert.equal(before.due.length,0);
 assert.deepEqual(due.due.map(x=>x.id),[a.id]);assert.deepEqual(due.newItems.map(x=>x.id),[b.id]);
});

test('changed evidence pauses old grades and conservatively makes previously practiced item due',()=>{
 const a=answer(),storage=memory(),state=at(storage,a,day(2026,10,20));
 assert.equal(getReviewSummary([a],state).gradedCount,1);
 const revised={...a,correctOption:'A'},progress=reviewProgress(revised,state,day(2026,10,20));
 assert.equal(progress.dueDate,'2026-10-20');assert.equal(progress.passed,false);
 assert.equal(getReviewSummary([revised],state).gradedCount,0);
 const pending={...a,verification:{status:'pending',note:'发现需重核'}};
 assert.equal(getReviewSummary([pending],state).gradedCount,0);assert.equal(reviewProgress(pending,state).dueDate,null);
 for(const revised of [
  {...a,question:{...a.question,versionNote:'同日更正版本说明'}},
  {...a,question:{...a.question,sourceUrl:'https://example.test/revised-source'}},
  {...a,sources:[{title:'同日替换证据',url:'https://example.test/new-evidence'}]}
 ]){
  assert.notEqual(reviewEvidenceKey(revised),reviewEvidenceKey(a));
  assert.equal(getReviewSummary([revised],state).gradedCount,0);
  assert.equal(reviewProgress(revised,state,day(2026,10,20)).dueDate,'2026-10-20');
 }
 assert.deepEqual(loadStudy(storage).reviewAttempts,state.reviewAttempts);
});

test('new backups restore attempts and all private data; repeated imports do not duplicate attempts',()=>{
 const a=answer(),storage=memory(legacy());
 at(storage,a,day(2026,10,20),'B',{confidence:'sure'});at(storage,a,day(2026,10,21),'A',{confidence:'unsure'});
 const backup=loadStudy(storage),fresh=memory();
 const first=mergeStudy(fresh,backup,['card-01']),second=mergeStudy(fresh,backup,['card-01']);
 assert.equal(first.reviewAttemptCount,2);assert.equal(second.state.reviewAttempts[a.id].length,2);
 assert.deepEqual(first.state.questions,backup.questions);
 for(const field of ['questionDraft','reviewAttempts'])assert.deepEqual(second.state[field],backup[field]);
 assert.deepEqual({...second.state.questions[qaId],updatedAt:backup.questions[qaId].updatedAt},backup.questions[qaId]);
 assert.equal(second.state.cards['card-01'].note,backup.cards['card-01'].note);
 assert.equal(second.state.answerNotes[a.id].note,backup.answerNotes[a.id].note);
 mergeStudy(fresh,{schema:1,cards:{},scratchpad:''},['card-01']);
 assert.deepEqual(loadStudy(fresh).reviewAttempts,backup.reviewAttempts);
});

test('conflicting attempt ids preserve both records once and report the conflict',()=>{
 const a=answer(),storage=memory(),date=day(2026,10,20);
 at(storage,a,date,'B',{attemptId:'attempt-test-01'});
 const backup=loadStudy(storage);backup.reviewAttempts[a.id][0].selectedOption='A';backup.reviewAttempts[a.id][0].correct=false;
 const merged=mergeStudy(storage,backup,[]),again=mergeStudy(storage,backup,[]);
 assert.equal(merged.reviewConflicts.length,1);assert.equal(merged.warnings.length,1);
 assert.equal(again.state.reviewAttempts[a.id].length,2);
 assert.deepEqual(again.state.reviewAttempts[a.id].map(a=>a.selectedOption).sort(),['A','B']);
 assert.equal(again.reviewConflicts[0].importedId,merged.reviewConflicts[0].importedId);
});

test('a stable attempt id makes retries safe, including an uncertain write outcome',()=>{
 const a=answer(),storage=memory(),selection={selectedOption:'B',confidence:'sure',attemptId:'attempt-retry'};
 const unavailable={getItem:storage.getItem,setItem:()=>{throw Error('quota');}};
 assert.throws(()=>recordReviewAttempt(unavailable,a,selection,day(2026,10,20)),/储存空间不足/);
 assert.equal(storage.getItem(STATE_KEY),null);
 const uncertain={getItem:storage.getItem,setItem:(key,value)=>{storage.setItem(key,value);throw Error('late error');}};
 assert.throws(()=>recordReviewAttempt(uncertain,a,selection,day(2026,10,20)),/储存空间不足/);
 const state=recordReviewAttempt(storage,a,selection,day(2026,10,21));
 assert.equal(state.reviewAttempts[a.id].length,1);assert.equal(state.reviewAttempts[a.id][0].localDate,'2026-10-20');
 assert.throws(()=>recordReviewAttempt(storage,a,{...selection,selectedOption:'A'},day(2026,10,21)),/已保存/);
});

test('invalid/future backups and attempt data never overwrite saved notes',()=>{
 const storage=memory(legacy()),before=storage.getItem(STATE_KEY),a=answer();
 for(const invalid of [
  {...legacy(),schema:3},
  {...emptyStudy(),reviewAttempts:[]},
  {...emptyStudy(),reviewAttempts:{'example-01':[{}]}},
  JSON.parse('{"schema":2,"cards":{},"scratchpad":"","reviewAttempts":{"constructor":[]}}')
 ]){assert.throws(()=>mergeStudy(storage,invalid,['card-01']));assert.equal(storage.getItem(STATE_KEY),before);}
 for(const selection of [{selectedOption:'C'},{selectedOption:'B',confidence:'certain'},{selectedOption:'B',attemptId:'__proto__'}]){
  assert.throws(()=>recordReviewAttempt(storage,a,selection));assert.equal(storage.getItem(STATE_KEY),before);
 }
 const valid=at(memory(),a,day(2026,10,20));
 for(const patch of [{localDate:'2026-02-30'},{answeredAt:'yesterday'},{correct:'true'},{evidenceKey:'guessed-key'}]){
  const bad=structuredClone(valid);Object.assign(bad.reviewAttempts[a.id][0],patch);
  assert.throws(()=>mergeStudy(storage,bad,['card-01']));assert.equal(storage.getItem(STATE_KEY),before);
 }
 const corrupt={getItem:()=>'{bad',setItem:()=>assert.fail('must not replace corrupt data')};assert.throws(()=>loadStudy(corrupt));
 assert.equal({}.polluted,undefined);
});

test('existing question identity conflicts and draft preservation remain idempotent',()=>{
 const storage=memory(legacy()),other=legacy();other.questions[qaId].paper='另一张卷';other.questions[qaId].note='另一题的笔记';other.questionDraft.paper='另一份草稿';
 const result=mergeStudy(storage,other,['card-01']),again=mergeStudy(storage,other,['card-01']);
 assert.equal(result.conflicts.length,1);assert.equal(Object.keys(again.state.questions).length,2);
 assert.equal(again.state.questions[qaId].paper,'我自己的试卷');
 assert.equal(again.state.questions[result.conflicts[0].importedId].note,'另一题的笔记');
 assert.deepEqual(again.state.questionDraft,legacy().questionDraft);assert.match(again.state.scratchpad,/另一份草稿/);
 assert.equal(again.state.scratchpad,result.state.scratchpad);
});

test('existing note APIs keep review history through subsequent edits',()=>{
 const storage=memory(legacy()),a=answer();at(storage,a,day(2026,10,20));const attempts=loadStudy(storage).reviewAttempts;
 saveCard(storage,'card-01',{note:'更新知识笔记'},['card-01']);
 saveQuestion(storage,qaId,{note:'更新临时笔记'});
 saveAnswerNote(storage,a.id,{note:'更新复盘'});
 saveQuestionDraft(storage,null);saveScratchpad(storage,'更新随手记');
 assert.deepEqual(loadStudy(storage).reviewAttempts,attempts);assert.equal(loadStudy(storage).answerNotes[a.id].mastered,true);
});

test('calendar due dates handle leap years, year boundaries, local midnight, and DST zones',()=>{
 const a=answer(),originalZone=process.env.TZ;
 const run=date=>reviewProgress(a,{reviewAttempts:{[a.id]:[{id:'attempt-calendar',answeredAt:date.toISOString(),localDate:localDate(date),correct:true,selectedOption:'B',evidenceKey:reviewEvidenceKey(a)}]}},date).dueDate;
 const expected={'UTC':'2026-10-20','America/Los_Angeles':'2026-10-19','Asia/Shanghai':'2026-10-20','Pacific/Kiritimati':'2026-10-20'};
 try{for(const [zone,value]of Object.entries(expected)){
  process.env.TZ=zone;
  assert.equal(run(new Date(2028,1,28,23,59)),'2028-02-29',zone);
  assert.equal(run(new Date(2028,1,29,23,59)),'2028-03-01',zone);
  assert.equal(run(new Date(2026,11,31,23,59)),'2027-01-01',zone);
  assert.equal(run(new Date(2026,2,7,23,59)),'2026-03-08',zone);
  assert.equal(run(new Date(2026,2,8,23,59)),'2026-03-09',zone);
  assert.equal(run(new Date(2026,9,31,23,59)),'2026-11-01',zone);
  assert.equal(run(new Date(2026,10,1,23,59)),'2026-11-02',zone);
  assert.equal(localDate(new Date(2026,9,20,0,1)),'2026-10-20',zone);
  assert.equal(localDate(new Date('2026-10-20T00:30:00.000Z')),value,zone);
 }}finally{if(originalZone===undefined)delete process.env.TZ;else process.env.TZ=originalZone;}
});
