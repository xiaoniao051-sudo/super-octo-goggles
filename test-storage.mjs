import assert from 'node:assert/strict';
import {loadStudy,saveCard,saveScratchpad,saveQuestion,saveAnswerNote,saveQuestionDraft,mergeStudy,STATE_KEY} from './storage.js';
const makeStorage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};
const storage=makeStorage(),ids=['data-01'];
const qa1='qa-12345678-1234-4234-8234-123456789abc',qa2='qa-12345678-1234-4234-8234-123456789abd';
const patch={paper:'2025 国考行政执法卷',number:'32',doubt:'为何不能选 B？'};
const draft={paper:'2026 国考行政执法卷',number:'',subject:'行测',source:'',myAnswer:'',doubt:'',stem:''};
assert.deepEqual(loadStudy(storage).questions,{});
assert.deepEqual(loadStudy(storage).answerNotes,{});
assert.equal(loadStudy(storage).questionDraft,null);

// The original format and original public API remain compatible.
saveCard(storage,'data-01',{note:'只在此设备保存',starred:true},ids);
saveCard(storage,'data-01',{mastered:true},ids);
saveQuestion(storage,qa1,patch);
saveAnswerNote(storage,'answer-01',{note:'用自己的话复述',mastered:true});
saveQuestionDraft(storage,draft);
const oldBackup={schema:1,cards:{'data-01':{note:'备份中的错因',starred:false,mastered:false}},scratchpad:'计划'};
mergeStudy(storage,oldBackup,ids);
assert.match(loadStudy(storage).cards['data-01'].note,/只在此设备保存[\s\S]*备份中的错因/);
assert.equal(loadStudy(storage).cards['data-01'].mastered,true);
assert.equal(loadStudy(storage).questions[qa1].paper,patch.paper);
assert.equal(loadStudy(storage).answerNotes['answer-01'].mastered,true);
assert.deepEqual(loadStudy(storage).questionDraft,draft);
const oldDevice=makeStorage();oldDevice.setItem(STATE_KEY,JSON.stringify(oldBackup));
assert.deepEqual(loadStudy(oldDevice).questions,{});
assert.equal(loadStudy(oldDevice).questionDraft,null);
assert.equal(oldDevice.getItem(STATE_KEY),JSON.stringify(oldBackup),'loading must not rewrite old records');

// A quick question needs only its paper and number; no doubt is invented.
const quickStorage=makeStorage();
saveQuestion(quickStorage,qa1,{paper:'2026 国考行政执法卷',number:'18'});
const quickQuestion=loadStudy(quickStorage).questions[qa1];
for(const key of ['source','myAnswer','doubt','stem','note'])assert.equal(quickQuestion[key],'');
saveQuestion(quickStorage,qa1,{note:'保留私人复盘',doubt:''});
const quickRestored=makeStorage();mergeStudy(quickRestored,loadStudy(quickStorage),ids);
assert.deepEqual(loadStudy(quickRestored).questions,loadStudy(quickStorage).questions);

// Same question number, different papers: independent notes and progress.
saveQuestion(storage,qa2,{...patch,paper:'2024 国考行政执法卷'});
saveQuestion(storage,qa1,{note:'注意限定范围',mastered:true,myAnswer:'A'});
saveQuestion(storage,qa2,{note:'先看转折词'});
assert.equal(Object.keys(loadStudy(storage).questions).length,2);
assert.equal(loadStudy(storage).questions[qa1].subject,'行测');
assert.equal(loadStudy(storage).questions[qa2].mastered,false);
assert.equal(loadStudy(storage).questions[qa1].note,'注意限定范围');
for(const [key,value]of [['paper','另一张卷'],['number','33'],['subject','申论'],['source','另一个版本']]){
 const before=storage.getItem(STATE_KEY);assert.throws(()=>saveQuestion(storage,qa1,{[key]:value}),/不能修改/);assert.equal(storage.getItem(STATE_KEY),before);
}
saveAnswerNote(storage,'answer-01',{note:'更新复盘'});
assert.equal(loadStudy(storage).answerNotes['answer-01'].mastered,true);
saveAnswerNote(storage,'answer-01',{mastered:false});
assert.equal(loadStudy(storage).answerNotes['answer-01'].note,'更新复盘');

// Repeated backups do not append the same notes repeatedly.
const imported=structuredClone(loadStudy(storage));
imported.cards['data-01'].note='另一设备知识笔记';
imported.questions[qa1].note='另一设备题目笔记';
imported.questions[qa1].myAnswer='C';
imported.answerNotes['answer-01'].note='另一设备解析复盘';
mergeStudy(storage,imported,ids);
const first=loadStudy(storage);mergeStudy(storage,imported,ids);const second=loadStudy(storage);
for(const key of ['note','myAnswer'])assert.equal(second.questions[qa1][key],first.questions[qa1][key]);
assert.equal(second.cards['data-01'].note,first.cards['data-01'].note);
assert.equal(second.answerNotes['answer-01'].note,first.answerNotes['answer-01'].note);

// A reused ID for another paper is forked once, not overwritten or duplicated.
const conflicted={schema:1,cards:{},scratchpad:'',questions:{[qa1]:{...loadStudy(storage).questions[qa1],paper:'2023 福建省考',note:'另一试卷的错因'}}};
const conflict=mergeStudy(storage,conflicted,ids);assert.equal(conflict.conflicts.length,1);assert.equal(conflict.warnings.length,1);
const forkId=conflict.conflicts[0].importedId;assert.notEqual(forkId,qa1);
assert.equal(conflict.state.questions[qa1].paper,patch.paper);
assert.equal(conflict.state.questions[forkId].paper,'2023 福建省考');
const repeated=mergeStudy(storage,conflicted,ids);assert.equal(repeated.conflicts[0].importedId,forkId);
assert.equal(Object.keys(repeated.state.questions).length,3);
assert.equal(repeated.state.questions[forkId].note,'另一试卷的错因');

// Drafts survive old imports, clear explicitly, and preserve conflicting drafts.
const otherDraft={...draft,paper:'尚未整理的另一份卷',doubt:'不明白第一个条件',stem:'题干第一行\n题干第二行'};
const draftBackup={schema:1,cards:{},scratchpad:'',questionDraft:otherDraft};
const mergedDraft=mergeStudy(storage,draftBackup,ids);
assert.deepEqual(mergedDraft.state.questionDraft,draft);
assert.match(mergedDraft.state.scratchpad,/尚未整理的另一份卷/);
assert.match(mergedDraft.state.scratchpad,/题干第一行\n题干第二行/);
const scratch=mergedDraft.state.scratchpad;assert.equal(mergeStudy(storage,draftBackup,ids).state.scratchpad,scratch);
saveQuestionDraft(storage,null);assert.equal(loadStudy(storage).questionDraft,null);
assert.deepEqual(mergeStudy(storage,draftBackup,ids).state.questionDraft,otherDraft);

// All new fields restore to a fresh browser, with no loss on quota/validation errors.
const backup=loadStudy(storage),newPhone=makeStorage(),restored=mergeStudy(newPhone,backup,ids);
assert.equal(restored.count,1);
assert.equal(restored.questionCount,3);
assert.equal(restored.answerNoteCount,1);
assert.equal(restored.totalCount,5);
assert.deepEqual(loadStudy(newPhone).questions,backup.questions);
assert.deepEqual(loadStudy(newPhone).questionDraft,backup.questionDraft);
assert.equal(loadStudy(newPhone).answerNotes['answer-01'].note,backup.answerNotes['answer-01'].note);
const before=storage.getItem(STATE_KEY),quota={getItem:storage.getItem,setItem:()=>{throw Error('Quota');}};
for(const action of [()=>saveScratchpad(quota,'不能保存'),()=>saveQuestion(quota,qa1,{note:'不能保存'}),()=>saveAnswerNote(quota,'answer-01',{note:'不能保存'}),()=>saveQuestionDraft(quota,draft),()=>mergeStudy(quota,oldBackup,ids)]){
 assert.throws(action,/储存空间不足/);assert.equal(storage.getItem(STATE_KEY),before);
}
for(const action of [
 ()=>saveQuestion(storage,'qa-invalid',patch),
 ()=>saveQuestion(storage,'qa-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',{paper:'',number:'1',doubt:'疑问'}),
 ()=>saveQuestion(storage,qa1,{doubt:42}),
 ()=>saveQuestion(storage,qa1,{stem:'字'.repeat(30001)}),
 ()=>saveQuestion(storage,qa1,{mastered:'yes'}),
 ()=>saveQuestionDraft(storage,{...draft,number:32}),
 ()=>saveAnswerNote(storage,'answer-01',{note:'字'.repeat(100001)}),
 ()=>saveAnswerNote(storage,'constructor',{note:'bad'}),
 ()=>mergeStudy(storage,{schema:1,cards:{'data-01':{note:'文'.repeat(100001),starred:false,mastered:false}},scratchpad:''},ids),
 ()=>mergeStudy(storage,{schema:1,cards:{},scratchpad:'',questions:[]},ids),
 ()=>mergeStudy(storage,JSON.parse('{"schema":1,"cards":{},"scratchpad":"","__proto__":{"polluted":true}}'),ids),
 ()=>mergeStudy(storage,JSON.parse('{"schema":1,"cards":{"constructor":{"note":"x","starred":false,"mastered":false}},"scratchpad":""}'),ids),
 ()=>mergeStudy(storage,{...oldBackup,questionDraft:Object.assign(Object.create({polluted:true}),draft)},ids)
]){assert.throws(action);assert.equal(storage.getItem(STATE_KEY),before);}
assert.equal({}.polluted,undefined);
const corrupt={getItem:()=>'{bad',setItem:()=>assert.fail('must not overwrite corrupt data')};assert.throws(()=>loadStudy(corrupt));
console.log('PASS old backup compatibility, question identity, notes/progress, idempotent conflict forks/imports, draft preservation, fresh-device restoration, quota safety, format and prototype protection');
