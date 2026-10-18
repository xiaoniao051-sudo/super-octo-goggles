import {saveQuestion,saveAnswerNote,saveQuestionDraft} from './storage.js?v=20261018-10';

const $=s=>document.querySelector(s);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const fields=['paper','number','subject','source','myAnswer','doubt','stem'];
const blank=()=>({paper:'',number:'',subject:'行测',source:'',myAnswer:'',doubt:'',stem:''});
const label=q=>`${q.paper} · 第 ${q.number.replace(/^第\s*|\s*题$/g,'')} 题`;
const identity=q=>[q.paper,q.number,q.subject,q.source].join('\n');

// Copy only fields the learner explicitly entered for this question.
export function questionMessage(id,q){
 return ['【国考题目答疑】','答疑编号：'+id,'试卷：'+q.paper,'科目：'+q.subject,'题号：'+q.number,
  '资料版本 / 平台：'+(q.source||'未填写，请结合截图核对'),q.myAnswer?'我的选择 / 作答：'+q.myAnswer:'',
  '我卡住的地方：'+q.doubt,q.stem?'题干 / 选项 / 材料：\n'+q.stem:'题干与选项 / 申论材料：请另附清晰截图。',
  '\n请先核对试卷版本和原题，不要只凭题号猜题。请解释考点、解题过程、选项或作答依据，以及容易错在哪里。',
  '解析整理好后，请按这个答疑编号更新到网站“题目答疑”；私人复盘笔记不要公开。'].filter(Boolean).join('\n');
}

export function createQuestionBoard({getStudy,setStudy,openModal,toast}){
 let answers=[],loadState='loading',tab='mine',status='all',query='',requestSequence=0;
 const unsaved=new Map();
 function snapshot(){const copy=structuredClone(getStudy());for(const task of unsaved.values())task.apply(copy);return copy;}
 const state=()=>unsaved.size?snapshot():getStudy();
 const samePaper=(a,q)=>a.paper===q.paper&&a.number===q.number&&a.subject===q.subject&&a.sourceVersion===q.source;
 const matched=id=>answers.filter(a=>a.requestIds.includes(id)&&samePaper(a,state().questions[id]));
 const requestStatus=(id,q)=>q.mastered?'understood':matched(id).length?'answered':'waiting';
 const statusLabel={waiting:'待解答',answered:'有解析',understood:'已弄懂'};
 const publicNote=id=>state().answerNotes?.[id]||{note:'',mastered:false};
 function commit(action,feedback){try{setStudy(action());if(feedback){feedback.textContent='已保存到此设备';feedback.classList.remove('error');}return true;}catch(e){if(feedback){feedback.textContent='尚未保存：'+e.message;feedback.classList.add('error');}toast(e.message);return false;}}
 function reliable(key,action,apply,feedback){const ok=commit(action,feedback);if(ok)unsaved.delete(key);else unsaved.set(key,{action,apply});return ok;}
 function saveDraft(value,feedback){return reliable('draft',()=>saveQuestionDraft(localStorage,value),s=>{s.questionDraft=value;},feedback);}
 function saveNote(type,id,note,feedback){return reliable(type+':'+id,()=>type==='question'?saveQuestion(localStorage,id,{note}):saveAnswerNote(localStorage,id,{note}),s=>{const records=type==='question'?s.questions:s.answerNotes;records[id]={...(records[id]||{mastered:false}),note,updatedAt:new Date().toISOString()};},feedback);}
 function flush(){for(const[key,task]of [...unsaved]){if(commit(task.action))unsaved.delete(key);}if(unsaved.size)throw Error('答疑内容尚未保存到设备，可先在“我的”备份当前记录；请勿刷新或关闭页面');}
 function button(text,cls,action){const b=el('button',cls,text);b.type='button';b.onclick=action;return b;}
 function paragraph(text,cls='qa-copy'){return el('p',cls,text);}
 function empty(title,body,action){const box=el('section','empty');box.append(el('h3','',title),paragraph(body));if(action)box.append(button('记一道不会的题','primary-btn',action));return box;}
 async function loadAnswers(){
  const seq=++requestSequence;loadState='loading';render();
  try{const response=await fetch('./answers.json',{cache:'no-cache'});if(!response.ok)throw Error('解析暂时无法加载');const data=await response.json();
   const ids=new Set();if(data.schema!==1||!Array.isArray(data.answers))throw Error('解析文件格式不正确');
   for(const a of data.answers){if(!/^[a-z0-9-]{1,64}$/.test(a.id)||['constructor','prototype','__proto__'].includes(a.id)||ids.has(a.id)||!Array.isArray(a.requestIds)||!a.requestIds.every(id=>/^qa-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))||!['paper','number','subject','sourceVersion','title','summary','answer','reviewedAt'].every(k=>typeof a[k]==='string')||!Array.isArray(a.sections)||!a.sections.every(s=>typeof s.heading==='string'&&typeof s.body==='string')||!Array.isArray(a.sources)||!a.sources.every(s=>typeof s.title==='string'&&typeof s.url==='string'))throw Error('解析内容格式不正确');ids.add(a.id);}
   if(seq!==requestSequence)return;answers=data.answers;loadState='ready';
  }catch{if(seq!==requestSequence)return;loadState='error';}render();
 }
 function render(){
  const mine=Object.entries(state().questions||{}).sort((a,b)=>(b[1].updatedAt||'').localeCompare(a[1].updatedAt||''));
  $('#qa-mine-count').textContent=mine.length;$('#qa-answer-count').textContent=loadState==='ready'?answers.length:'—';
  document.querySelectorAll('[data-qa-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.qaTab===tab);b.setAttribute('aria-pressed',String(b.dataset.qaTab===tab));});
  $('#qa-status').hidden=tab!=='mine';const target=$('#qa-list');target.replaceChildren();
  $('#qa-draft-hint').hidden=!state().questionDraft;
  const loading=$('#qa-loading');loading.replaceChildren();
  if(loadState==='error'){loading.append(paragraph('公开解析暂时没加载出来。我的问题仍可记录；已有解析的状态暂不判断。','warning'),button('重新加载解析','quiet-btn',loadAnswers));}
  else if(loadState==='loading')loading.append(paragraph('正在核对已发布解析…','muted'));
  const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if(tab==='mine'){
   const filtered=mine.filter(([id,q])=>{const s=requestStatus(id,q);return(status==='all'||(status==='waiting'&&loadState!=='ready'?false:s===status))&&words.every(w=>[q.paper,q.number,q.subject,q.source,q.doubt,q.stem,q.note].join(' ').toLowerCase().includes(w));});
   if(!filtered.length)target.append(empty(mine.length?'没有符合条件的问题':'把不会的，留在这里',mine.length?'试试试卷名、题号或错因，也可以切回“全部状态”。':'记下试卷和题号，复制给他。解析更新后，回到这里把思路弄明白。',mine.length?null:newQuestion));
   for(const[id,q]of filtered){const b=button('','knowledge-card qa-card',()=>openQuestion(id)),meta=el('div','qa-meta'),s=requestStatus(id,q);meta.append(el('span','',q.subject),el('span','qa-badge '+s,loadState!=='ready'&&!q.mastered?'待核对解析':statusLabel[s]));b.append(meta,el('h3','',label(q)),paragraph(q.doubt),el('span','card-state',[q.source,q.note?'有复盘笔记':'点开记录自己的思路'].filter(Boolean).join(' · ')));target.append(b);}
  }else{
   const filtered=answers.filter(a=>words.every(w=>[a.title,a.paper,a.number,a.subject,a.summary,a.answer,...a.sections.map(s=>s.heading+' '+s.body)].join(' ').toLowerCase().includes(w)));
   if(!filtered.length&&loadState==='ready')target.append(empty(answers.length?'没有找到这道题':'第一份解析，从你的问题开始',answers.length?'试试试卷名、题号或考点关键词。':'你把题目发给他，他转给我解答。整理好的解析会更新到这里，原来的网址不变。'));
   for(const a of filtered){const b=button('','knowledge-card qa-card',()=>openAnswer(a)),meta=el('div','qa-meta');meta.append(el('span','',a.subject),el('span','qa-badge answered',publicNote(a.id).mastered?'已弄懂':'已发布解析'));b.append(meta,el('h3','',a.title),paragraph(label(a)),el('span','card-state','核对日期 '+a.reviewedAt+' · 查看讲解与记笔记'));target.append(b);}
  }
 }
 function inputField(form,key,title,options={}){
  const wrapper=el('label','qa-field'+(options.wide?' wide':''));wrapper.append(el('span','',title));
  const input=el(options.multiline?'textarea':key==='subject'?'select':'input');input.id='qa-'+key;input.name=key;
  if(key==='subject'){for(const v of ['行测','申论']){const option=el('option','',v);option.value=v;input.append(option);}}
  else{input.placeholder=options.placeholder||'';input.maxLength=options.max||200;if(options.multiline)input.rows=options.rows||3;else input.type='text';}
  input.required=!!options.required;input.value=form.values[key]||'';wrapper.append(input);if(options.hint)wrapper.append(el('small','',options.hint));form.inputs[key]=input;form.grid.append(wrapper);
 }
 function newQuestion(){
  const content=openModal('记一道不会的题'),form=el('form','qa-form'),values={...blank(),...(state().questionDraft||{})};
  const grid=el('div','qa-form-grid'),inputs={},f={grid,inputs,values};
  form.append(paragraph('填写后点“给张菁伟发微信~qaq”会保存并复制问题，再到微信粘贴发送。','qa-notice'),grid);
  inputField(f,'paper','试卷名称与卷型 *',{wide:true,required:true,max:200,placeholder:'例如：2025 国考行政执法卷',hint:'写清年份、考试名称、卷型，避免同题号混淆。'});
  inputField(f,'number','题号 *',{required:true,max:40,placeholder:'例如：32 或 第一题（2）'});
  inputField(f,'subject','科目',{required:true});
  inputField(f,'source','资料版本 / 平台',{wide:true,max:500,placeholder:'例如：粉笔回忆版、某套模拟卷',hint:'不同平台可能重新编号，建议附上题目截图。'});
  inputField(f,'myAnswer','我的选择 / 作答',{wide:true,multiline:true,max:500,rows:2,placeholder:'例如：我选 B，参考答案是 D。'});
  inputField(f,'doubt','我卡住的地方 *',{wide:true,required:true,multiline:true,max:5000,placeholder:'例如：B 和 D 看着都对，应该看材料里的哪句话？'});
  inputField(f,'stem','题干、选项或材料（可选）',{wide:true,multiline:true,max:30000,placeholder:'能粘贴的文字放这里；图片请随复制内容另发给他。',hint:'申论题请同时提供作答要求、相关给定资料和自己的答案。'});
  const saved=el('p','save-status','输入后保存草稿到此设备'),actions=el('div','qa-actions');saved.setAttribute('role','status');
  const read=()=>Object.fromEntries(fields.map(k=>[k,inputs[k].value]));
  form.addEventListener('input',()=>saveDraft(read(),saved));
  const save=async copy=>{
   if(!form.reportValidity())return;
   const q=read();for(const k of fields)q[k]=q[k].trim();if(!q.paper||!q.number||!q.doubt){saved.textContent='请填写试卷、题号和具体疑问，不能只填空格。';saved.classList.add('error');return;}
   const existing=Object.entries(state().questions||{}).find(([,x])=>identity(x)===identity(q)&&x.doubt===q.doubt&&x.stem===q.stem&&x.myAnswer===q.myAnswer);
   const id=existing?.[0]||'qa-'+crypto.randomUUID();
   const createdAt=new Date().toISOString();
   if(!reliable('create:'+id,()=>saveQuestion(localStorage,id,q),s=>{s.questions[id]={...q,note:'',mastered:false,createdAt,updatedAt:createdAt,...s.questions[id]};},saved)){showCopy(questionMessage(id,q),'问题未存入设备，请先备份');toast('编号与内容暂留当前页面，可到“我的”备份；请勿刷新或关闭页面');return;}
   saveDraft(null);render();openQuestion(id);toast(existing?'这道问题已在“我的问题”里':'问题已保存；复制后请自行发给他');
   if(copy)await copyMessage(id);
  };
  const saveBtn=el('button','quiet-btn','保存到我的问题');saveBtn.type='submit';form.onsubmit=e=>{e.preventDefault();save(false);};
  actions.append(button('给张菁伟发微信~qaq','primary-btn',()=>save(true)),saveBtn);form.append(saved,actions);content.append(form);
 }
 function showCopy(text,title='长按下面的文字复制'){
  const content=openModal(title);content.append(paragraph('复制后粘贴到你们的聊天中，再补上清晰的题目截图。这里不会自动发送。'));
  const area=el('textarea','note-box qa-copy-box');area.readOnly=true;area.setAttribute('aria-label','待复制的问题文本');area.value=text;content.append(area,button('选中全部文字','quiet-btn',()=>{area.focus();area.select();area.setSelectionRange(0,area.value.length);}));area.focus();area.select();area.setSelectionRange(0,area.value.length);
 }
 async function copyMessage(id){const q=state().questions?.[id];if(!q)return;const text=questionMessage(id,q);try{if(!navigator.clipboard?.writeText)throw Error('unavailable');await navigator.clipboard.writeText(text);toast('已复制，去微信发给张菁伟吧~qaq；图片另附');}catch{showCopy(text);}}
 function noteEditor(content,value,onSave,{mastered,onMastered,heading='我的复盘笔记'}={}){
  const block=el('section','qa-note-section'),saved=el('span','save-status','只保存在此设备'),head=el('div','note-heading');saved.setAttribute('role','status');head.append(el('h3','',heading),saved);
  const area=el('textarea','note-box');area.value=value||'';area.maxLength=100000;area.setAttribute('aria-label',heading);area.placeholder='我原来怎么想？错在哪里？下次看到什么条件要提醒自己？';
  area.oninput=()=>onSave(area.value,saved);block.append(head,area,button('保存复盘笔记','text-btn',()=>onSave(area.value,saved)));
  if(onMastered){const label=el('label','qa-check'),input=el('input');input.type='checkbox';input.checked=!!mastered;input.onchange=()=>{if(!onMastered(input.checked,saved))input.checked=!input.checked;};label.append(input,el('span','','我能自己讲明白了，标为已弄懂'));block.append(label);}
  content.append(block);
 }
 function openQuestion(id){
  const q=state().questions?.[id];if(!q)return;
  const content=openModal('我的问题'),links=matched(id);content.append(el('h3','qa-title',label(q)),paragraph([q.subject,q.source].filter(Boolean).join(' · '),'muted'),paragraph('答疑编号：'+id,'qa-id'));
  const actions=el('div','qa-actions');actions.append(button('给张菁伟发微信~qaq','primary-btn',()=>copyMessage(id)),button('查看待发送文字','quiet-btn',()=>showCopy(questionMessage(id,state().questions[id]))));content.append(actions,paragraph('点击上方按钮复制问题，再到微信粘贴发给张菁伟。解析发布时会按答疑编号关联到这里。','qa-notice'));
  content.append(el('h3','','我卡住的地方'),paragraph(q.doubt));if(q.myAnswer)content.append(el('h3','','我的选择 / 作答'),paragraph(q.myAnswer));
  if(q.stem){const details=el('details','qa-stem');details.append(el('summary','','查看原题文字'),paragraph(q.stem));content.append(details);}
  const answerBox=el('section','qa-answer-links');answerBox.append(el('h3','','这道题的解析'));
  if(links.length)for(const a of links)answerBox.append(button(a.title+' →','qa-answer-link',()=>openAnswer(a,id)));
  else answerBox.append(paragraph(loadState==='ready'?(answers.some(a=>a.requestIds.includes(id))?'发现同编号解析，但试卷信息不一致。请发给张菁伟核对后再看，避免看错题。':'还没有发布。把题目发给他，整理好的解析会出现在这里。'):'公开解析尚未加载成功，请关闭弹窗后重新加载。'));
  content.append(answerBox);
  noteEditor(content,q.note,(note,feedback)=>saveNote('question',id,note,feedback),{mastered:q.mastered,onMastered:(mastered,feedback)=>{const ok=commit(()=>saveQuestion(localStorage,id,{mastered}),feedback);render();return ok;}});
 }
 function openAnswer(a,requestId){
  const content=openModal('题目解析');if(requestId)content.append(button('‹ 返回我的问题','text-btn',()=>openQuestion(requestId)));
  content.append(el('h3','qa-title',a.title),paragraph(label(a)+' · '+a.subject,'muted'),paragraph('核对日期 '+a.reviewedAt+' · 学习解析，非官方标准答案','muted'));
  if(a.summary)content.append(paragraph(a.summary,'qa-notice'));
  content.append(el('h3','','答案 / 作答要点'),paragraph(a.answer));for(const s of a.sections)content.append(el('h3','',s.heading),paragraph(s.body));
  if(a.sources.length){const details=el('details','reader-sources');details.append(el('summary','','原题与核对来源'));for(const s of a.sources){if(!/^https?:\/\//.test(s.url))continue;const link=el('a','qa-source-link',s.title+' ↗');link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';details.append(link);}content.append(details);}
  // When opened from a local question, keep its existing reflection beside the explanation.
  if(requestId){const q=state().questions[requestId];noteEditor(content,q.note,(note,feedback)=>saveNote('question',requestId,note,feedback),{mastered:q.mastered,onMastered:(mastered,feedback)=>{const ok=commit(()=>saveQuestion(localStorage,requestId,{mastered}),feedback);render();return ok;}});}
  else {const note=publicNote(a.id);noteEditor(content,note.note,(value,feedback)=>saveNote('answer',a.id,value,feedback),{mastered:note.mastered,onMastered:(mastered,feedback)=>{const ok=commit(()=>saveAnswerNote(localStorage,a.id,{mastered}),feedback);render();return ok;}});}
 }
 $('#qa-new').onclick=newQuestion;$('#qa-draft-hint').onclick=newQuestion;$('#qa-refresh').onclick=loadAnswers;
 document.querySelectorAll('[data-qa-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.qaTab;render();});
 $('#qa-search').oninput=e=>{query=e.target.value;render();};$('#qa-status').onchange=e=>{status=e.target.value;render();};
 loadAnswers();return {render,newQuestion,flush,snapshot,hasUnsaved:()=>unsaved.size>0};
}
