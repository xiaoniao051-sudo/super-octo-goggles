import assert from 'node:assert/strict';
import {inspectNotes,inspectionSummary} from './note-inspection.js';
import {emptyStudy} from './storage.js';
function readOnly(raw){let reads=0;return {getItem(key){assert.equal(key,'guokao-2027-study-v1');reads++;return raw;},setItem(){assert.fail('Inspection must never write');},removeItem(){assert.fail('Inspection must never delete');},clear(){assert.fail('Inspection must never clear');},get reads(){return reads;}};}
for(const [raw,status]of [[null,'missing'],['','invalid'],['{broken','invalid'],['{}','invalid']]){const storage=readOnly(raw),result=inspectNotes(storage);assert.equal(result.status,status);assert.equal(result.raw,raw);assert.equal(storage.reads,1);}
assert.equal(inspectNotes({getItem(){throw Error('denied');}}).status,'blocked');
const state=emptyStudy();state.cards={'old-card':{note:'PRIVATE CARD TEXT',starred:true,mastered:false}};
state.answerNotes={'old-answer':{note:'PRIVATE ANSWER TEXT',mastered:true,updatedAt:'2026-10-18'}};
state.questions={'qa-12345678-1234-4234-8234-123456789abc':{paper:'测试卷',number:'59',subject:'行测',source:'',myAnswer:'A',doubt:'PRIVATE DOUBT',stem:'',note:'PRIVATE TEMP TEXT',mastered:false,createdAt:'2026-10-18',updatedAt:'2026-10-18'}};
state.scratchpad='PRIVATE SCRATCH';state.questionDraft={paper:'草稿卷',number:'3',subject:'行测',source:'',myAnswer:'',doubt:'PRIVATE DRAFT',stem:''};
const raw=JSON.stringify(state),storage=readOnly(raw),result=inspectNotes(storage,[],[]);
assert.equal(result.status,'ok');assert.equal(result.raw,raw);assert.equal(storage.reads,1);
assert.deepEqual(result.counts,{cards:1,answers:1,questions:1,scratchpad:1,draft:1,starred:1,mastered:0,understood:1});
assert.match(result.groups.cards[0].title,/old-card/);assert.equal(result.groups.answers[0].text,'PRIVATE ANSWER TEXT');assert.match(result.groups.questions[0].text,/PRIVATE TEMP TEXT/);
const summary=inspectionSummary(result,'https://example.test');assert.doesNotMatch(summary,/PRIVATE|测试卷|草稿卷/);assert.match(summary,/错题解析笔记：1/);
const named=inspectNotes(readOnly(raw),[{id:'old-card',title:'卡片标题'}],[{id:'old-answer',paper:'公开试卷',number:'59',title:'第59题'}]);assert.equal(named.groups.cards[0].title,'卡片标题');assert.match(named.groups.answers[0].title,/公开试卷.*第59题/);
assert.equal(inspectNotes(readOnly(JSON.stringify({schema:1,cards:{},scratchpad:''}))).status,'ok');
console.log('PASS: read-only inspection preserves absent, corrupt, blocked and legacy data; includes every note namespace and unknown IDs; shared report excludes note content.');
