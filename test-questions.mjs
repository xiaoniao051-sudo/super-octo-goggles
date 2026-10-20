import assert from 'node:assert/strict';
import {loadStudy,saveQuestion,saveAnswerNote,STATE_KEY} from './storage.js';
import {createQuestionBoard,questionMessage} from './questions.js';

// A minimal DOM double exercises application callbacks without network or browsers.
class Node {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.listeners={};this.attributes={};this.value='';this.textContent='';this.className='';this.open=false;this.classList={add(){},remove(){},toggle(){}};}
 get firstChild(){return this.children[0]||null;}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=[...children];this.textContent='';}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(key,fn){this.listeners[key]=fn;}
 focus(options){this.focused=true;this.focusOptions=options;} scrollIntoView(options){this.scrollOptions=options;} select(){} setSelectionRange(){} reportValidity(){return true;}
}
const nodes=new Map(),tabs=['mine','published','practice'].map(value=>{const n=new Node('button');n.dataset.qaTab=value;return n;});
globalThis.document={createElement:tag=>new Node(tag),querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,new Node());return nodes.get(selector);},querySelectorAll:selector=>selector==='[data-qa-tab]'?tabs:[]};
const walk=n=>[n,...(n.children||[]).flatMap(child=>typeof child==='object'?walk(child):[])];
const find=(n,predicate)=>walk(n).find(predicate);
const textOf=n=>[n.textContent,...(n.children||[]).map(child=>typeof child==='object'?textOf(child):child)].join(' ');
const values=new Map();let quota=false;
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(quota)throw Error('Quota');values.set(key,value);}};
const id='qa-12345678-1234-4234-8234-123456789abc';
saveQuestion(localStorage,id,{paper:'2025 国考行政执法卷',number:'32',source:'粉笔回忆版',doubt:'为什么不选 B？',note:'绝不分享的私人笔记'});
let study=loadStudy(localStorage),modal,modalTitle,modalTools,modalFooter,modalOptions,modalClosed=false;const toasts=[];
let publicData={schema:1,answers:[
 {id:'answer-01',requestIds:[id],paper:study.questions[id].paper,number:'32',subject:'行测',sourceVersion:'粉笔回忆版',title:'正确对应的解析',summary:'逐项比对',answer:'选 D',reviewedAt:'2026-10-18',sections:[],sources:[]},
 {id:'answer-wrong',requestIds:[id],paper:'2024 国考行政执法卷',number:'32',subject:'行测',sourceVersion:'粉笔回忆版',title:'不应关联到原题的解析',summary:'其他试卷',answer:'选 A',reviewedAt:'2026-10-18',sections:[],sources:[]}
]};
globalThis.fetch=async()=>({ok:true,json:async()=>structuredClone(publicData)});
const board=createQuestionBoard({getStudy:()=>study,setStudy:value=>{study=value;},openModal:(title,options={})=>{modalClosed=false;modalTitle=title;modalOptions=options;modalTools=options.tools;modalFooter=options.footer;modal=new Node();return modal;},closeModal:()=>{modalClosed=true;},toast:value=>toasts.push(value)});
const settle=()=>new Promise(resolve=>setImmediate(resolve));await settle();

// Full questions appear before an initially closed explanation, and remain searchable.
publicData.answers[0].question={stem:'题干独有检索词：保持全部前提。',prompt:'请选择最恰当的一项。',options:[{label:'A',text:'选项独有检索词'},{label:'B',text:'第二项'},{label:'C',text:'第三项'},{label:'D',text:'第四项'}],versionNote:'公开回忆整理版',sourceUrl:'https://example.com/question'};
await nodes.get('#qa-refresh').onclick();
nodes.get('#qa-list').children[0].onclick();
const original=find(modal,n=>n.className==='qa-original');
assert.ok(textOf(original).includes('保持全部前提'));
assert.deepEqual(walk(original).filter(n=>n.className==='qa-option-label').map(n=>n.textContent),['A','B','C','D']);
const explanation=find(modal,n=>n.className==='qa-explanation');
assert.equal(explanation.open,false);
assert.ok(textOf(explanation).includes('选 D'));
assert.ok(!textOf(original).includes('选 D'));
assert.ok(modal.children.indexOf(original)<modal.children.indexOf(explanation));
assert.ok(find(modal,n=>n.tagName==='TEXTAREA'));
for(const value of ['题干独有检索词','选项独有检索词']){nodes.get('#qa-search').oninput({target:{value}});assert.equal(nodes.get('#qa-list').children.length,1);assert.match(textOf(nodes.get('#qa-list')),/正确对应的解析/);}
nodes.get('#qa-search').oninput({target:{value:''}});
// Legacy published entries without full question data still show their answer and notes.
nodes.get('#qa-list').children[1].onclick();
assert.ok(textOf(modal).includes('选 A'));assert.ok(find(modal,n=>n.tagName==='TEXTAREA'));
const validQuestion=structuredClone(publicData.answers[0].question);
publicData.answers[0].question.options[0].text={invalid:true};
await nodes.get('#qa-refresh').onclick();assert.match(textOf(nodes.get('#qa-loading')),/暂时没加载出来/);
publicData.answers[0].question=validQuestion;await nodes.get('#qa-refresh').onclick();

// The shared collection is the landing view; local recording stays secondary.
assert.equal(tabs[1].attributes['aria-pressed'],'true');
assert.equal(nodes.get('#qa-new').hidden,true);
assert.equal(nodes.get('#qa-draft-hint').hidden,true);
assert.equal(nodes.get('#qa-list').children.length,2);

const copied=questionMessage(id,study.questions[id]);
assert.ok(copied.includes(id));assert.ok(copied.includes('为什么不选 B？'));
assert.ok(!copied.includes('绝不分享的私人笔记'));
assert.ok(!copied.includes('mastered'));

// Public answers only attach when the full paper identity agrees.
tabs[0].onclick();assert.equal(nodes.get('#qa-new').hidden,false);
nodes.get('#qa-list').children[0].onclick();
assert.equal(modalTitle,'临时记题');
assert.ok(textOf(modal).includes('正确对应的解析'));
assert.ok(!textOf(modal).includes('不应关联到原题的解析'));

// Question reflection survives failed storage, modal reopening, and retry.
let area=find(modal,n=>n.tagName==='TEXTAREA');quota=true;
area.value='设备写入失败时仍保留这段复盘';area.oninput();
assert.equal(board.hasUnsaved(),true);
assert.equal(board.snapshot().questions[id].note,area.value);
assert.equal(loadStudy(localStorage).questions[id].note,'绝不分享的私人笔记');
assert.throws(()=>board.flush(),/尚未保存/);
board.render();nodes.get('#qa-list').children[0].onclick();
area=find(modal,n=>n.tagName==='TEXTAREA');assert.equal(area.value,'设备写入失败时仍保留这段复盘');
area.value='再次修改后保留最新稿';area.oninput();
const snapshot=board.snapshot();snapshot.questions[id].note='改快照不应修改内部状态';
assert.equal(board.snapshot().questions[id].note,'再次修改后保留最新稿');
quota=false;board.flush();assert.equal(board.hasUnsaved(),false);
assert.equal(loadStudy(localStorage).questions[id].note,'再次修改后保留最新稿');

// Public-answer reflections have the same retry and backup protection.
tabs[1].onclick();nodes.get('#qa-list').children[0].onclick();
area=find(modal,n=>n.tagName==='TEXTAREA');quota=true;area.value='公开解析的私人复盘';area.oninput();
assert.equal(board.snapshot().answerNotes['answer-01'].note,'公开解析的私人复盘');
assert.throws(()=>board.flush(),/尚未保存/);
board.render();nodes.get('#qa-list').children[0].onclick();
assert.equal(find(modal,n=>n.tagName==='TEXTAREA').value,'公开解析的私人复盘');
quota=false;board.flush();assert.equal(loadStudy(localStorage).answerNotes['answer-01'].note,'公开解析的私人复盘');

// Shared questions use their own progress, independent of matching local questions.
const publicMastered=find(modal,n=>n.tagName==='INPUT'&&n.type==='checkbox');
publicMastered.checked=true;publicMastered.onchange();
assert.equal(loadStudy(localStorage).answerNotes['answer-01'].mastered,true);
assert.equal(loadStudy(localStorage).questions[id].mastered,false);
nodes.get('#qa-status').onchange({target:{value:'unmastered'}});
assert.equal(nodes.get('#qa-list').children.length,1);
assert.ok(textOf(nodes.get('#qa-list')).includes('不应关联到原题的解析'));
nodes.get('#qa-status').onchange({target:{value:'understood'}});
assert.equal(nodes.get('#qa-list').children.length,1);
assert.ok(textOf(nodes.get('#qa-list')).includes('正确对应的解析'));
nodes.get('#qa-status').onchange({target:{value:'all'}});

// New publications lead regardless of file position; revisions do not change first-added order.
const originalPublicData=structuredClone(publicData);
const answerFixture=(id,title,addedAt)=>({...originalPublicData.answers[1],id,requestIds:[],title,...(addedAt?{addedAt}:{})});
publicData.answers=[
 answerFixture('legacy-first','旧版未标日期一'),
 {...originalPublicData.answers[0],addedAt:'2026-10-18',reviewedAt:'2026-10-29'},
 answerFixture('new-first','同日新题一','2026-10-19'),
 answerFixture('legacy-second','旧版未标日期二'),
 answerFixture('new-second','同日新题二','2026-10-19')
];
const visibleTitles=()=>nodes.get('#qa-list').children.map(n=>find(n,c=>c.tagName==='H3')?.textContent);
await nodes.get('#qa-refresh').onclick();
const expectedOrder=['同日新题一','同日新题二','正确对应的解析','旧版未标日期一','旧版未标日期二'];
assert.deepEqual(visibleTitles(),expectedOrder);
assert.equal(nodes.get('#qa-order-hint').textContent,'新收录的题目在前');
publicData.answers[0].reviewedAt='2026-12-31';
publicData.answers[1].reviewedAt='2027-01-01';
await nodes.get('#qa-refresh').onclick();assert.deepEqual(visibleTitles(),expectedOrder);
nodes.get('#qa-search').oninput({target:{value:'同日新题'}});
assert.deepEqual(visibleTitles(),['同日新题一','同日新题二']);
nodes.get('#qa-search').oninput({target:{value:''}});
nodes.get('#qa-status').onchange({target:{value:'unmastered'}});
assert.deepEqual(visibleTitles(),['同日新题一','同日新题二','旧版未标日期一','旧版未标日期二']);
nodes.get('#qa-status').onchange({target:{value:'understood'}});
assert.deepEqual(visibleTitles(),['正确对应的解析']);
nodes.get('#qa-list').children[0].onclick();
assert.equal(find(modal,n=>n.tagName==='TEXTAREA').value,'公开解析的私人复盘');
nodes.get('#qa-status').onchange({target:{value:'all'}});
publicData=originalPublicData;await nodes.get('#qa-refresh').onclick();

// Exact question numbers cannot accidentally match the year or another number.
const savedUxState=localStorage.getItem(STATE_KEY),savedUxData=structuredClone(publicData);
const uxAnswer=(answerId,paper,number)=>({...savedUxData.answers[0],id:answerId,requestIds:[],paper,number,title:answerId,question:{...validQuestion,stem:'共同知识：数字题号检索'},addedAt:'2026-10-19'});
publicData={schema:1,answers:[
 uxAnswer('ux-first','2023 甲卷','003'),
 uxAnswer('ux-other-paper','2023 乙卷','3'),
 uxAnswer('ux-second','2023 甲卷','第 32 题'),
 uxAnswer('ux-mastered','2023 甲卷','13'),
 uxAnswer('ux-third','2023 甲卷','68')
]};
await nodes.get('#qa-refresh').onclick();
for(const value of ['3','第 3 题','003','第００３题']){
 nodes.get('#qa-search').oninput({target:{value}});
 assert.deepEqual(visibleTitles(),['ux-first','ux-other-paper']);
 assert.equal(nodes.get('#qa-results').textContent,'2 道 / 共 5 道');
}
nodes.get('#qa-search').oninput({target:{value:'32'}});
assert.deepEqual(visibleTitles(),['ux-second']);
nodes.get('#qa-search').oninput({target:{value:'共同知识'}});
assert.equal(visibleTitles().length,5);
nodes.get('#qa-paper').onchange({target:{value:'2023 甲卷'}});
assert.deepEqual(visibleTitles(),['ux-first','ux-second','ux-mastered','ux-third']);
assert.equal(nodes.get('#qa-paper').value,'2023 甲卷');
assert.equal(nodes.get('#qa-reset').hidden,false);
study=saveAnswerNote(localStorage,'ux-second',{note:'按条件比较，保留自己的错因'});
board.render();
assert.match(textOf(nodes.get('#qa-list').children[1]),/有复盘笔记/);
nodes.get('#qa-status').onchange({target:{value:'noted'}});
assert.deepEqual(visibleTitles(),['ux-second']);
assert.equal(nodes.get('#qa-results').textContent,'1 道 / 共 5 道');
nodes.get('#qa-search').oninput({target:{value:'不存在的词'}});
assert.equal(nodes.get('#qa-results').textContent,'0 道 / 共 5 道');
find(nodes.get('#qa-list'),n=>n.tagName==='BUTTON'&&n.textContent==='清除筛选').onclick();
assert.equal(visibleTitles().length,5);
assert.equal(nodes.get('#qa-reset').hidden,true);
assert.equal(nodes.get('#qa-paper').value,'all');
assert.equal(nodes.get('#qa-status').value,'all');
assert.equal(nodes.get('#qa-search').value,'');

// The reading queue is the filtered list captured at open time, even after mastery changes.
study=saveAnswerNote(localStorage,'ux-mastered',{mastered:true});
nodes.get('#qa-paper').onchange({target:{value:'2023 甲卷'}});
nodes.get('#qa-status').onchange({target:{value:'unmastered'}});
assert.deepEqual(visibleTitles(),['ux-first','ux-second','ux-third']);
assert.equal(nodes.get('#qa-list').children[0].dataset.answerId,'ux-first');
nodes.get('#qa-list').children[0].onclick();
assert.equal(modalOptions.reader,true);
assert.equal(modal.dataset.answerId,'ux-first');
assert.equal(find(modalFooter,n=>n.className==='qa-reader-position').textContent,'1 / 3');
assert.equal(find(modalFooter,n=>n.dataset.qaStep==='previous').disabled,true);
const readerExplanation=find(modal,n=>n.className==='qa-explanation');
assert.equal(readerExplanation.open,false);
const assertActiveJump=expected=>{for(const key of ['question','explanation','note']){const b=find(modalTools,n=>n.dataset.qaJump===key);assert.equal(b.attributes['aria-pressed'],String(key===expected));assert.equal(b.className.split(' ').includes('active'),key===expected);}};
assertActiveJump('question');
find(modalTools,n=>n.dataset.qaJump==='explanation').onclick();
assertActiveJump('explanation');
assert.equal(readerExplanation.open,true);
assert.equal(readerExplanation.scrollOptions.block,'start');
const originalEditor=find(modal,n=>n.tagName==='TEXTAREA');
find(modalTools,n=>n.dataset.qaJump==='note').onclick();
assertActiveJump('note');
assert.equal(originalEditor.focused,true);
assert.equal(originalEditor.focusOptions.preventScroll,true);
assert.equal(find(modal,n=>n.tagName==='TEXTAREA'),originalEditor);
find(modalTools,n=>n.dataset.qaJump==='question').onclick();assertActiveJump('question');
const markRead=find(modal,n=>n.tagName==='INPUT'&&n.type==='checkbox');
markRead.checked=true;markRead.onchange();
assert.deepEqual(visibleTitles(),['ux-second','ux-third']);
find(modalFooter,n=>n.dataset.qaStep==='next').onclick();
assert.equal(modal.dataset.answerId,'ux-second');
assertActiveJump('question');
assert.equal(find(modalFooter,n=>n.className==='qa-reader-position').textContent,'2 / 3');
assert.equal(find(modal,n=>n.className==='qa-explanation').open,false);
assert.equal(find(modal,n=>n.tagName==='TEXTAREA').value,'按条件比较，保留自己的错因');

// Failed storage must keep the same reader and the latest text, with an in-page explanation.
quota=true;const blockedReader=modal,blockedEditor=find(modal,n=>n.tagName==='TEXTAREA');
blockedEditor.value='尚未落盘时，不能切走这段文字';blockedEditor.oninput();
find(modalFooter,n=>n.dataset.qaStep==='next').onclick();
assert.equal(modal,blockedReader);assert.equal(modal.dataset.answerId,'ux-second');
assert.equal(find(modal,n=>n.tagName==='TEXTAREA'),blockedEditor);
assert.match(textOf(modalFooter),/尚未切换/);
assert.equal(board.snapshot().answerNotes['ux-second'].note,blockedEditor.value);
quota=false;find(modalFooter,n=>n.dataset.qaStep==='next').onclick();
assert.equal(modal.dataset.answerId,'ux-third');
assert.equal(find(modalFooter,n=>n.className==='qa-reader-position').textContent,'3 / 3');
assert.equal(find(modalFooter,n=>n.dataset.qaStep==='next').disabled,true);
find(modalFooter,n=>n.dataset.qaStep==='previous').onclick();
assert.equal(modal.dataset.answerId,'ux-second');
assert.equal(find(modal,n=>n.tagName==='TEXTAREA').value,'尚未落盘时，不能切走这段文字');
find(modalFooter,n=>n.dataset.qaStep==='previous').onclick();
assert.equal(modal.dataset.answerId,'ux-first');
assert.equal(find(modal,n=>n.tagName==='INPUT'&&n.type==='checkbox').checked,true);
assert.equal(loadStudy(localStorage).answerNotes['ux-second'].note,'尚未落盘时，不能切走这段文字');
assert.equal(nodes.get('#review-qa-count').textContent,'3 道未弄懂 · 1 道有复盘笔记');

// Local records use the same exact-number, paper and note filters without sharing public notes.
nodes.get('#qa-reset').onclick();tabs[0].onclick();
nodes.get('#qa-paper').onchange({target:{value:'2025 国考行政执法卷'}});
nodes.get('#qa-status').onchange({target:{value:'noted'}});
nodes.get('#qa-search').oninput({target:{value:'第032题'}});
assert.equal(nodes.get('#qa-results').textContent,'1 道 / 共 1 道');
nodes.get('#qa-search').oninput({target:{value:'3'}});
assert.equal(nodes.get('#qa-results').textContent,'0 道 / 共 1 道');
nodes.get('#qa-reset').onclick();tabs[1].onclick();
localStorage.setItem(STATE_KEY,savedUxState);study=loadStudy(localStorage);publicData=savedUxData;
await nodes.get('#qa-refresh').onclick();

// Incomplete drafts remain copyable/exportable and reappear after a failed save.
tabs[0].onclick();
board.newQuestion();let form=find(modal,n=>n.tagName==='FORM');
find(form,n=>n.name==='paper').value='未填写完成的草稿';
find(form,n=>n.name==='doubt').value='条件顺序不明白';
quota=true;form.listeners.input();
assert.equal(board.snapshot().questionDraft.paper,'未填写完成的草稿');
assert.throws(()=>board.flush(),/尚未保存/);
board.newQuestion();form=find(modal,n=>n.tagName==='FORM');
assert.equal(find(form,n=>n.name==='paper').value,'未填写完成的草稿');
quota=false;board.flush();assert.equal(board.hasUnsaved(),false);
assert.equal(loadStudy(localStorage).questionDraft.doubt,'条件顺序不明白');

// Failed first saves retain the exact shared request ID through backup and retry.
board.newQuestion();form=find(modal,n=>n.tagName==='FORM');
find(form,n=>n.name==='paper').value='2026 福建省考行政执法卷';
find(form,n=>n.name==='number').value='56';
find(form,n=>n.name==='subject').value='行测';
find(form,n=>n.name==='source').value='模拟测试版本';
find(form,n=>n.name==='doubt').value='首次保存失败仍要保持同一答疑编号';
quota=true;form.listeners.input();
await find(form,n=>n.tagName==='BUTTON'&&n.textContent==='给张菁伟发微信~qaq').onclick();
const failedCopy=find(modal,n=>n.tagName==='TEXTAREA'&&n.readOnly).value;
const failedId=failedCopy.match(/答疑编号：(qa-[0-9a-f-]+)/)?.[1];assert.ok(failedId);
assert.equal(board.hasUnsaved(),true);
assert.equal(loadStudy(localStorage).questions[failedId],undefined);
assert.equal(board.snapshot().questions[failedId].doubt,'首次保存失败仍要保持同一答疑编号');
assert.throws(()=>board.flush(),/尚未保存/);
const portable=JSON.stringify(board.snapshot());
const recovered=loadStudy({getItem:()=>portable});
assert.equal(recovered.questions[failedId].paper,'2026 福建省考行政执法卷');
assert.equal(recovered.questions[failedId].number,'56');
board.newQuestion();form=find(modal,n=>n.tagName==='FORM');
assert.equal(find(form,n=>n.name==='paper').value,'2026 福建省考行政执法卷');
const saveButton=find(form,n=>n.tagName==='BUTTON'&&n.textContent==='保存到临时记题');
assert.equal(saveButton?.type,'submit');
assert.equal(saveButton.className,'primary-btn');
quota=false;form.onsubmit({preventDefault(){}});await settle();
assert.equal(board.hasUnsaved(),false);
assert.equal(loadStudy(localStorage).questions[failedId].doubt,'首次保存失败仍要保持同一答疑编号');
assert.equal(Object.values(loadStudy(localStorage).questions).filter(q=>q.paper==='2026 福建省考行政执法卷').length,1);
assert.equal(loadStudy(localStorage).questionDraft,null);
assert.ok(textOf(modal).includes(failedId));

// Reuse the most recently created paper, not an older question edited later.
const recentId='qa-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const previousId='qa-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeef';
const prepared=loadStudy(localStorage);
for(const q of Object.values(prepared.questions))q.createdAt='2026-10-01T00:00:00.000Z';
prepared.questions[recentId]={...prepared.questions[id],paper:'2026 国考申论执法卷',number:'四',subject:'申论',source:'旧题来源不应沿用',myAnswer:'旧题作答',doubt:'旧题疑问',stem:'旧题原文',createdAt:'2026-10-17T00:00:00.000Z',updatedAt:'2026-10-17T00:00:00.000Z'};
prepared.questions[previousId]={...prepared.questions[id],paper:'较早记录的试卷',createdAt:'2026-10-16T00:00:00.000Z',updatedAt:'2026-10-18T00:00:00.000Z'};
localStorage.setItem(STATE_KEY,JSON.stringify(prepared));study=loadStudy(localStorage);
board.render();
assert.match(textOf(nodes.get('#qa-list').children[0]),/2026 国考申论执法卷/);
assert.match(textOf(nodes.get('#qa-list').children[1]),/较早记录的试卷/);
assert.equal(nodes.get('#qa-order-hint').textContent,'新记录的题目在前');
study=saveQuestion(localStorage,previousId,{note:'刚刚修改旧题笔记，不改变首次录入顺序'});board.render();
assert.match(textOf(nodes.get('#qa-list').children[0]),/2026 国考申论执法卷/);
assert.match(textOf(nodes.get('#qa-list').children[1]),/较早记录的试卷/);
board.newQuestion();form=find(modal,n=>n.tagName==='FORM');
assert.equal(find(form,n=>n.name==='paper').value,'2026 国考申论执法卷');
assert.equal(find(form,n=>n.name==='subject').value,'申论');
assert.equal(find(form,n=>n.name==='number').value,'');
let optional=find(form,n=>n.tagName==='DETAILS');
assert.equal(optional.open,false);
assert.deepEqual(walk(form).filter(n=>n.required).map(n=>n.name).sort(),['number','paper']);
for(const key of ['source','myAnswer','doubt','stem']){
 assert.equal(find(form,n=>n.name===key).value,'');
 assert.ok(find(optional,n=>n.name===key));
}
assert.equal(find(form,n=>n.name==='paper').id,'qa-entry-paper');

// Only paper and number are enough for the real save-and-copy action.
find(form,n=>n.name==='paper').value='2026 简化录题测试卷';
find(form,n=>n.name==='number').value='18';
await find(form,n=>n.tagName==='BUTTON'&&n.textContent==='给张菁伟发微信~qaq').onclick();
const quickEntries=Object.entries(loadStudy(localStorage).questions).filter(([,q])=>q.paper==='2026 简化录题测试卷');
assert.equal(quickEntries.length,1);
const [quickId,quickQuestion]=quickEntries[0];
for(const key of ['source','myAnswer','doubt','stem'])assert.equal(quickQuestion[key],'');
const quickCopy=find(modal,n=>n.tagName==='TEXTAREA'&&n.readOnly).value;
assert.ok(quickCopy.includes(quickId));assert.ok(quickCopy.includes('题号：18'));
assert.match(quickCopy,/截图/);
assert.ok(!quickCopy.includes('我卡住的地方：'));
assert.ok(!quickCopy.includes('资料版本 / 平台：'));
assert.ok(!quickCopy.includes('我的选择 / 作答：'));
tabs[0].onclick();assert.match(textOf(nodes.get('#qa-list')),/截图和疑问可在微信补充/);

// Drafts win over remembered paper values, including deliberate clearing and optional text.
board.newQuestion();form=find(modal,n=>n.tagName==='FORM');
const draftValues={paper:'',number:'27',subject:'行测',source:'草稿的试卷版本',myAnswer:'我选 A',doubt:'不理解转折关系',stem:'保留题干第一行\n第二行'};
for(const [key,value]of Object.entries(draftValues))find(form,n=>n.name===key).value=value;
form.listeners.input();board.newQuestion();form=find(modal,n=>n.tagName==='FORM');
for(const [key,value]of Object.entries(draftValues))assert.equal(find(form,n=>n.name===key).value,value);
optional=find(form,n=>n.tagName==='DETAILS');assert.equal(optional.open,false);
assert.match(textOf(optional.firstChild),/有已填内容/);
assert.deepEqual(loadStudy(localStorage).questionDraft,draftValues);
tabs[1].onclick();assert.equal(nodes.get('#qa-new').hidden,true);assert.equal(nodes.get('#qa-draft-hint').hidden,true);
tabs[0].onclick();assert.equal(nodes.get('#qa-new').hidden,false);assert.equal(nodes.get('#qa-draft-hint').hidden,false);

// Loader rejects IDs the persistent note store cannot support.
publicData={schema:1,answers:[{...publicData.answers[0],id:'a'.repeat(65)}]};
await nodes.get('#qa-refresh').onclick();
assert.match(textOf(nodes.get('#qa-loading')),/暂时没加载出来/);
assert.ok(localStorage.getItem(STATE_KEY));

// Not-yet-understood questions remain filterable when public answers cannot load.
study=saveQuestion(localStorage,id,{mastered:true});
nodes.get('#qa-status').onchange({target:{value:'unmastered'}});
const remaining=nodes.get('#qa-list').children;
assert.equal(remaining.length,Object.values(study.questions).filter(q=>!q.mastered).length);
assert.ok(!textOf(nodes.get('#qa-list')).includes('2025 国考行政执法卷'));
assert.ok(textOf(nodes.get('#qa-list')).includes('2026 简化录题测试卷'));

// Independent practice never inserts answer-bearing text or prior notes before submission.
const practiceAnswer={
 ...originalPublicData.answers[0],id:'practice-fixture',requestIds:[],
 title:'SPOILER_TITLE',summary:'SPOILER_SUMMARY',answer:'SPOILER_ANSWER_B',
 question:{...validQuestion,versionNote:'SPOILER_VERSION'},
 sections:[{heading:'SPOILER_HEADING',body:'SPOILER_BODY'}],
 verification:{status:'checked',note:'题面已核对，参考解析。'},correctOption:'B'
};
publicData={schema:1,answers:[practiceAnswer,...['pending','incomplete','disputed'].map(status=>({
 ...practiceAnswer,id:'practice-'+status,number:status,verification:{status,note:'需要进一步核对'},correctOption:undefined
}))]};
study=saveAnswerNote(localStorage,practiceAnswer.id,{note:'SPOILER_PRIVATE_NOTE',mastered:true});
await nodes.get('#qa-refresh').onclick();
tabs[2].onclick();
assert.doesNotMatch(textOf(nodes.get('#qa-list')),/SPOILER/);
assert.match(textOf(nodes.get('#qa-today')),/0 道到期.*1 道未开始.*3 道待核/);
nodes.get('#qa-list').children[0].onclick();
assert.doesNotMatch(textOf(modal),/SPOILER/);
assert.equal(find(modal,n=>n.tagName==='TEXTAREA'),undefined);
assert.equal(find(modal,n=>n.className==='qa-explanation'),undefined);
let practiceForm=find(modal,n=>n.className==='qa-practice-form');
const practiceSubmit=find(modalFooter,n=>n.type==='submit');
assert.ok(practiceSubmit,'practice submission is available in the fixed footer');
assert.equal(practiceSubmit.attributes.form,practiceForm.id);
assert.equal(practiceSubmit.disabled,true);
practiceForm.onsubmit({preventDefault(){}});
assert.equal(study.reviewAttempts[practiceAnswer.id],undefined);
find(practiceForm,n=>n.name==='practice-option'&&n.value==='B').onchange();
find(practiceForm,n=>n.name==='practice-confidence'&&n.value==='unsure').onchange();
assert.equal(practiceSubmit.disabled,false);
quota=true;practiceForm.onsubmit({preventDefault(){}});
assert.equal(study.reviewAttempts[practiceAnswer.id],undefined);
assert.doesNotMatch(textOf(modal),/SPOILER/);
assert.match(textOf(modal),/尚未保存/);
quota=false;practiceForm.onsubmit({preventDefault(){}});
assert.match(textOf(modal),/本次复测通过/);
assert.match(textOf(modal),/SPOILER_ANSWER_B/);
assert.equal(study.reviewAttempts[practiceAnswer.id].length,1);
assert.equal(study.reviewAttempts[practiceAnswer.id][0].confidence,'unsure');
assert.equal(study.reviewAttempts[practiceAnswer.id][0].correct,true);
assert.equal(study.answerNotes[practiceAnswer.id].mastered,true);
assert.equal(study.answerNotes[practiceAnswer.id].note,'SPOILER_PRIVATE_NOTE');
practiceForm.onsubmit({preventDefault(){}});
assert.equal(study.reviewAttempts[practiceAnswer.id].length,1,'repeat delivery uses the same attempt ID');
for(let index=1;index<4;index++){
 nodes.get('#qa-list').children[index].onclick();
 assert.doesNotMatch(textOf(modal),/SPOILER/);
 practiceForm=find(modal,n=>n.className==='qa-practice-form');
 find(practiceForm,n=>n.name==='practice-option'&&n.value==='A').onchange();
 practiceForm.onsubmit({preventDefault(){}});
 assert.match(textOf(modal),/暂不判分/);
 const answer=publicData.answers[index];
 assert.equal(study.reviewAttempts[answer.id][0].correct,null);
 assert.equal(study.reviewAttempts[answer.id][0].confidence,null);
}
assert.match(textOf(nodes.get('#qa-today')),/有效作答 1\/1 正确/);
nodes.get('#qa-search').oninput({target:{value:'SPOILER_ANSWER_B'}});
assert.equal(nodes.get('#qa-results').textContent,'0 道 / 共 4 道','practice search does not match hidden explanations');
console.log('PASS neutral practice DOM and search, optional confidence, required selection, failed-save reveal guard, retry deduplication, subjective mastery preservation, all pending statuses excluded from grading');

// A new-question entry starts the whole eligible queue, which survives live filter changes.
const continuousAnswers=[1,2,3].map(number=>({...practiceAnswer,id:'continuous-'+number,number:String(number),paper:'连续练习测试卷'}));
publicData={schema:1,answers:[...continuousAnswers,{...continuousAnswers[0],id:'continuous-pending',number:'4',verification:{status:'pending',note:'待核对'},correctOption:undefined}]};
await nodes.get('#qa-refresh').onclick();
tabs[2].onclick();
find(nodes.get('#qa-today'),n=>n.tagName==='BUTTON'&&n.textContent==='连续做新题').onclick();
assert.equal(modal.dataset.answerId,'continuous-1');
assert.equal(find(modalFooter,n=>n.className==='qa-reader-position').textContent,'1 / 3');
const submitChoice=(option='B',confidence='')=>{
 const form=find(modal,n=>n.className==='qa-practice-form');
 const submit=find(modalFooter,n=>n.type==='submit');
 assert.equal(submit.attributes.form,form.id);
 assert.equal(submit.disabled,true);
 assert.doesNotMatch(textOf(modal),/SPOILER/);
 assert.equal(find(modal,n=>n.className==='qa-explanation'),undefined);
 assert.ok(walk(form).filter(n=>n.name==='practice-option').every(n=>!n.checked));
 assert.equal(find(form,n=>n.name==='practice-confidence'&&n.value==='').checked,true);
 find(form,n=>n.name==='practice-option'&&n.value===option).onchange();
 if(confidence)find(form,n=>n.name==='practice-confidence'&&n.value===confidence).onchange();
 assert.equal(submit.disabled,false);
 form.onsubmit({preventDefault(){}});
};
submitChoice('B','sure');
assert.equal(study.reviewAttempts['continuous-1'].length,1);
let continueButton=find(modalFooter,n=>n.tagName==='BUTTON'&&n.textContent==='继续下一题');
assert.ok(continueButton&&!continueButton.disabled);
const firstResult=modal,firstNote=find(modal,n=>n.tagName==='TEXTAREA');
quota=true;firstNote.value='连续做题也不能丢失未保存笔记';firstNote.oninput();
continueButton.onclick();
assert.equal(modal,firstResult);
assert.match(textOf(modalFooter),/尚未切换/);
quota=false;continueButton.onclick();
assert.equal(modal.dataset.answerId,'continuous-2');
assert.equal(find(modalFooter,n=>n.className==='qa-reader-position').textContent,'2 / 3');
assert.equal(loadStudy(localStorage).answerNotes['continuous-1'].note,firstNote.value);
assert.doesNotMatch(textOf(modal),/SPOILER/);
assert.equal(find(modal,n=>n.className==='qa-explanation'),undefined);
assert.equal(find(modal,n=>n.name==='practice-confidence'&&n.value==='').checked,true);
assert.ok(walk(modal).filter(n=>n.name==='practice-option').every(n=>!n.checked));
find(modal,n=>n.name==='practice-option'&&n.value==='A').onchange();
find(modalFooter,n=>n.tagName==='BUTTON'&&n.textContent==='跳过此题').onclick();
assert.equal(study.reviewAttempts['continuous-2'],undefined,'skipping a selected but unsubmitted choice does not record an attempt');
assert.equal(modal.dataset.answerId,'continuous-3');
assert.equal(find(modalFooter,n=>n.className==='qa-reader-position').textContent,'3 / 3');
submitChoice();
assert.equal(study.reviewAttempts['continuous-3'][0].confidence,null);
const finish=find(modalFooter,n=>n.tagName==='BUTTON'&&n.textContent==='完成本轮');
assert.ok(finish&&!finish.disabled);
const finalResult=modal,lastNote=find(modal,n=>n.tagName==='TEXTAREA');
quota=true;lastNote.value='完成本轮前保留这段复盘';lastNote.oninput();finish.onclick();
assert.equal(modalClosed,false);
assert.equal(modal,finalResult);
assert.match(textOf(modalFooter),/尚未切换/);
quota=false;finish.onclick();
assert.equal(modalClosed,true);
assert.equal(loadStudy(localStorage).answerNotes['continuous-3'].note,lastNote.value);
assert.equal(study.reviewAttempts['continuous-pending'],undefined);
assert.match(textOf(nodes.get('#qa-today')),/1 道未开始.*1 道待核/);

// Starting from the filtered practice list respects the selected subset and does not grow.
nodes.get('#qa-status').onchange({target:{value:'new'}});
const visiblePracticeIds=()=>nodes.get('#qa-list').children.filter(n=>n.dataset.answerId).map(n=>n.dataset.answerId);
assert.deepEqual(visiblePracticeIds(),['continuous-2']);
const listStart=[...nodes.values()].map(n=>find(n,x=>x.tagName==='BUTTON'&&x.textContent==='开始连续做题')).find(Boolean);
assert.ok(listStart,'the filtered practice list has a continuous-start action');
listStart.onclick();
assert.equal(modal.dataset.answerId,'continuous-2');
assert.equal(find(modalFooter,n=>n.className==='qa-reader-position').textContent,'1 / 1');
submitChoice();
assert.deepEqual(visiblePracticeIds(),[]);
find(modalFooter,n=>n.tagName==='BUTTON'&&n.textContent==='完成本轮').onclick();
assert.equal(modalClosed,true);
assert.equal(study.reviewAttempts['continuous-2'].length,1);
console.log('PASS complete new-question queue, fixed-footer submit, continuous next/reset, skipped choices unrecorded, filtered session stability, failed-note-save guards for next and finish, final return to list');
console.log('PASS exact numeric question search, paper/note filters and counts, clear filters, fixed filtered reading queue, mastery-safe paging, collapsed answers, jump navigation and original note focus, failed-save paging guard, retained reflection, newest-added order, stable note IDs, shared/local progress isolation, minimal record/copy, draft precedence, message privacy, exact association, failed snapshots and retry, stable failed-create IDs, public ID limits, offline filtering');
