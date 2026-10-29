import {saveQuestion,saveAnswerNote,saveQuestionDraft,recordReviewAttempt} from './storage.js?v=20261020-review2';
import {getVerification,getReviewSummary,reviewProgress,localDate} from './review.js?v=20261020-review2';
import {fetchJson} from './network.js?v=20261027-ux';

const $=s=>document.querySelector(s);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const fields=['paper','number','subject','source','myAnswer','doubt','stem'];
const blank=()=>({paper:'',number:'',subject:'行测',source:'',myAnswer:'',doubt:'',stem:''});
const label=q=>`${q.paper} · 第 ${q.number.replace(/^第\s*|\s*题$/g,'')} 题`;
const identity=q=>[q.paper,q.number,q.subject,q.source].join('\n');
const numberedQuery=value=>{const match=String(value).trim().normalize('NFKC').match(/^(?:第\s*)?(\d+)\s*(?:题)?$/);return match?match[1].replace(/^0+(?=\d)/,''):null;};
const hasNote=value=>typeof value==='string'&&!!value.trim();
const validQuestion=q=>q&&typeof q==='object'&&!Array.isArray(q)&&typeof q.stem==='string'&&q.stem.trim()&&['prompt','versionNote','sourceUrl'].every(k=>typeof q[k]==='string')&&Array.isArray(q.options)&&q.options.length<=8&&q.options.every(o=>o&&typeof o.label==='string'&&/^[A-H]$/.test(o.label)&&typeof o.text==='string'&&o.text.trim())&&new Set(q.options.map(o=>o.label)).size===q.options.length;

// Copy only fields the learner explicitly entered for this question.
export function questionMessage(id,q){
 return ['【国考题目答疑】','答疑编号：'+id,'试卷：'+q.paper,'科目：'+q.subject,'题号：'+q.number,
  q.source?'资料版本 / 平台：'+q.source:'',q.myAnswer?'我的选择 / 作答：'+q.myAnswer:'',
  q.doubt?'我卡住的地方：'+q.doubt:'',q.stem?'题干 / 选项 / 材料：\n'+q.stem:'题目截图和具体疑问，我在微信里补充。',
  '\n请先核对试卷版本和原题，不要只凭题号猜题。请解释考点、解题过程、选项或作答依据，以及容易错在哪里。',
  '解析整理好后，请按这个答疑编号更新到网站“错题库”；私人复盘笔记不要公开。'].filter(Boolean).join('\n');
}

export function createQuestionBoard({getStudy,setStudy,openModal,toast,navigate=()=>{},closeModal=()=>{}}){
 let answers=[],loadState='loading',tab='published',status='all',query='',paper='all',requestSequence=0;
 let initialAnswer=typeof location!=='undefined'?new URLSearchParams(location.search).get('answer'):null;
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
 function flush(){for(const[key,task]of [...unsaved]){if(commit(task.action))unsaved.delete(key);}if(unsaved.size)throw Error('错题内容尚未保存到设备，可先在“我的”备份当前记录；请勿刷新或关闭页面');}
 function button(text,cls,action){const b=el('button',cls,text);b.type='button';b.onclick=action;return b;}
 function paragraph(text,cls='qa-copy'){return el('p',cls,text);}
 function empty(title,body,action){const box=el('section','empty');box.append(el('h3','',title),paragraph(body));if(action)box.append(button('记一道不会的题','primary-btn',action));return box;}
 function resetFilters(){query='';paper='all';status='all';$('#qa-search').value='';$('#qa-status').value='all';render();}
 function filteredEmpty(title,body){const box=empty(title,body);box.append(button('清除筛选','quiet-btn',resetFilters));return box;}
 function verificationBadge(a){const v=getVerification(a);return el('span','qa-badge verification-'+v.status,v.label);}
 function verificationNotice(a){
  const v=getVerification(a),box=el('section','qa-verification verification-'+v.status);
  box.append(el('strong','',v.label),paragraph(v.note||'尚未完成题目核验。'));
  if(!v.canGrade)box.append(paragraph('本题只记录作答，不判对错，不计入正确率与到期队列。'));
  return box;
 }
 function setTab(value){
  tab=value;status='all';query='';$('#qa-search').value='';
  const choices=tab==='practice'?[['all','全部状态'],['due','今日到期'],['new','尚未开始'],['passed','复测通过'],['paused','待核题']]:[['all','全部状态'],['unmastered','未弄懂'],['understood','已弄懂'],['noted','有笔记']];
  const select=$('#qa-status');select.replaceChildren();
  for(const[value,text]of choices){const option=el('option','',text);option.value=value;select.append(option);}select.value='all';
  render();
 }
 function renderToday(){
  for(const selector of ['#home-today','#review-today','#qa-today']){
   const target=$(selector);if(!target)continue;target.replaceChildren();
   target.append(el('h2','','今日复习'));
   if(loadState!=='ready'){target.append(paragraph(loadState==='error'?'错题暂未加载，刷新后查看今日队列。':'正在读取复习记录…','muted'));continue;}
   const summary=getReviewSummary(answers,state()),count=summary.due.length;
   target.append(paragraph(`${count} 道到期 · ${summary.newItems.length} 道未开始 · ${summary.paused.length} 道待核`,'qa-today-count'));
   const detailText=paragraph(summary.gradedCount?`复测通过 ${summary.passedCount} 题 · 有效作答 ${summary.correctCount}/${summary.gradedCount} 正确（${Math.round(summary.correctCount/summary.gradedCount*100)}%）`:'还没有有效复测记录。先从一道错题开始，未做过的题不会算作逾期。','muted');
   if(!count&&summary.scheduled.length)target.append(paragraph('今天没有到期题。下次复习：'+summary.scheduled.map(a=>reviewProgress(a,state()).dueDate).sort()[0],'muted'));
   const actions=el('div','qa-actions');
   const start=items=>{setTab('practice');navigate('qa');if(items.length)openPractice(items[0],items.map(a=>a.id));};
   if(count)actions.append(button('开始今日复习','primary-btn',()=>start(getReviewSummary(answers,state()).due)));
   if(summary.newItems.length)actions.append(button('连续做新题','quiet-btn',()=>start(getReviewSummary(answers,state()).newItems)));
   actions.append(button('全部重做题目','text-btn',()=>{setTab('practice');navigate('qa');}));
   target.append(actions);
   const rule=el('details','qa-review-rule');rule.append(el('summary','','复习记录与安排'),detailText,paragraph('按本机日期计算。连续答对后依次间隔 1、3、7、14 天，再次答错回到 1 天；同日反复答对不加快升级。已弄懂是你原来的主观标记，复测通过只来自有效作答。待核题不判分；核验依据变化后重新复测。'));target.append(rule);
  }
 }
 async function loadAnswers(){
  const seq=++requestSequence;loadState='loading';render();
  try{const data=await fetchJson('./answers.json',{label:'错题解析'});
   const ids=new Set();if(data.schema!==1||!Array.isArray(data.answers))throw Error('解析文件格式不正确');
   for(const a of data.answers){if(!/^[a-z0-9-]{1,64}$/.test(a.id)||['constructor','prototype','__proto__'].includes(a.id)||ids.has(a.id)||!Array.isArray(a.requestIds)||!a.requestIds.every(id=>/^qa-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))||!['paper','number','subject','sourceVersion','title','summary','answer','reviewedAt'].every(k=>typeof a[k]==='string')||!Array.isArray(a.sections)||!a.sections.every(s=>typeof s.heading==='string'&&typeof s.body==='string')||!Array.isArray(a.sources)||!a.sources.every(s=>typeof s.title==='string'&&typeof s.url==='string'))throw Error('解析内容格式不正确');ids.add(a.id);}
   if(data.answers.some(a=>a.question!==undefined&&!validQuestion(a.question)))throw Error('题目内容格式不正确');
   if(data.answers.some(a=>a.addedAt!==undefined&&(typeof a.addedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(a.addedAt))))throw Error('收录日期格式不正确');
   // Stable sorting preserves same-day and undated legacy order; revisions do not move a question.
   if(seq!==requestSequence)return;answers=[...data.answers].sort((a,b)=>(b.addedAt||'').localeCompare(a.addedAt||''));loadState='ready';
   if(initialAnswer){const requested=initialAnswer;initialAnswer=null;const url=new URL(location.href);url.searchParams.delete('answer');history.replaceState(history.state,'',url.pathname+url.search+url.hash);const found=answers.find(a=>a.id===requested);if(found){navigate('qa');openAnswer(found);}else toast('这道题暂未收录，请在错题库搜索。');}
  }catch{if(seq!==requestSequence)return;loadState='error';}render();
 }
 function render(){
  renderToday();
  const mine=Object.entries(state().questions||{}).sort((a,b)=>(b[1].createdAt||'').localeCompare(a[1].createdAt||''));
  $('#qa-mine-count').textContent=mine.length;$('#qa-answer-count').textContent=loadState==='ready'?answers.length:'—';
  const papers=[...new Set((tab==='mine'?mine.map(([,q])=>q):answers).map(q=>q.paper))],paperSelect=$('#qa-paper');
  if(paper!=='all'&&!papers.includes(paper))paper='all';
  paperSelect.replaceChildren();for(const name of ['all',...papers]){const option=el('option','',name==='all'?'全部试卷':name);option.value=name;paperSelect.append(option);}paperSelect.value=paper;
  $('#qa-reset').hidden=!query.trim()&&paper==='all'&&status==='all';
  const reviewCount=$('#review-qa-count');if(reviewCount)reviewCount.textContent=loadState==='ready'?`${answers.filter(a=>!publicNote(a.id).mastered).length} 道未弄懂 · ${answers.filter(a=>hasNote(publicNote(a.id).note)).length} 道有复盘笔记`:loadState==='error'?'错题暂未加载，请重试':'正在核对错题记录';
  document.querySelectorAll('[data-qa-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.qaTab===tab);b.setAttribute('aria-pressed',String(b.dataset.qaTab===tab));});
  $('#qa-status').hidden=false;const target=$('#qa-list');target.replaceChildren();
  const practiceActions=$('#qa-practice-actions');if(practiceActions){practiceActions.replaceChildren();practiceActions.hidden=true;}
  $('#qa-new').hidden=tab!=='mine';$('#qa-draft-hint').hidden=tab!=='mine'||!state().questionDraft;
  $('#qa-order-hint').textContent=tab==='mine'?'新记录的题目在前':tab==='practice'?'中性题号 · 提交后查看解析':'新收录的题目在前';
  $('#qa-search').placeholder=tab==='practice'?'搜索试卷、题号或题干':'搜索题号、关键词或错因';
  const loading=$('#qa-loading');loading.replaceChildren();
  if(loadState==='error'){loading.append(paragraph('公开解析暂时没加载出来。错题仍可记录、复习；已有解析的状态暂不判断。','warning'),button('重新加载解析','quiet-btn',loadAnswers));}
  else if(loadState==='loading')loading.append(paragraph('正在核对已发布解析…','muted'));
  const number=numberedQuery(query),words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches=(q,text)=>(paper==='all'||q.paper===paper)&&(number!==null?numberedQuery(q.number)===number:words.every(w=>text.toLowerCase().includes(w)));
  if(tab==='mine'){
   const filtered=mine.filter(([id,q])=>{const s=requestStatus(id,q);return(status==='all'||(status==='noted'?hasNote(q.note):status==='unmastered'?!q.mastered:status==='waiting'&&loadState!=='ready'?false:s===status))&&matches(q,[q.paper,q.number,q.subject,q.source,q.doubt,q.stem,q.note].join(' '));});
   $('#qa-results').textContent=`${filtered.length} 道 / 共 ${mine.length} 道`;
   if(!filtered.length)target.append(mine.length?filteredEmpty('没有符合条件的错题','可以换个关键词，或清除筛选查看全部。'):empty('把不会的，留在这里','先记下试卷和题号，存进自己的错题库。复习时回来记错因，弄懂后做个标记。',newQuestion));
   for(const[id,q]of filtered){const b=button('','knowledge-card qa-card',()=>openQuestion(id)),meta=el('div','qa-meta'),s=requestStatus(id,q);meta.append(el('span','',q.subject),el('span','qa-badge '+s,loadState!=='ready'&&!q.mastered?'待核对解析':statusLabel[s]));b.append(meta,el('h3','',label(q)),paragraph(q.doubt||'截图和疑问可在微信补充'),el('span','card-state',[q.source,hasNote(q.note)?'有复盘笔记':'点开记录自己的思路'].filter(Boolean).join(' · ')));target.append(b);}
  }else if(tab==='practice'){
   const summary=getReviewSummary(answers,state()),ids=key=>new Set(summary[key].map(a=>a.id));
   const due=ids('due'),newItems=ids('newItems'),paused=ids('paused');
   const filtered=answers.filter(a=>(status==='all'||status==='due'&&due.has(a.id)||status==='new'&&newItems.has(a.id)||status==='paused'&&paused.has(a.id)||status==='passed'&&reviewProgress(a,state()).passed)&&matches(a,[a.paper,a.number,a.subject,a.question?.stem,a.question?.prompt,...(a.question?.options||[]).map(o=>o.text)].join(' ')));
   $('#qa-results').textContent=loadState==='ready'?`${filtered.length} 道 / 共 ${answers.length} 道`:'正在核对题目…';
   if(!filtered.length&&loadState==='ready')target.append(filteredEmpty('当前没有这一类题目','未开始的题不算逾期。可以清除筛选，选择一道开始重做。'));
   const queue=filtered.map(a=>a.id);
   if(practiceActions&&queue.length){practiceActions.hidden=false;practiceActions.append(button('开始连续做题','primary-btn',()=>openPractice(filtered[0],queue)),paragraph(`本轮 ${queue.length} 道 · 按当前筛选顺序，提交后继续下一题`,'muted'));}
   for(const a of filtered){
    const progress=reviewProgress(a,state()),b=button('','knowledge-card qa-card qa-practice-card',()=>openPractice(a,queue)),meta=el('div','qa-meta');b.dataset.answerId=a.id;
    meta.append(el('span','',a.subject),verificationBadge(a));
    const detail=paused.has(a.id)?'可练习，暂不判分':due.has(a.id)?'今日到期':newItems.has(a.id)?'尚未开始':`下次复习 ${progress.dueDate}`;
    b.append(meta,el('h3','',label(a)),paragraph('独立重做 · 先选答案，再看解析'),el('span','card-state',detail+(progress.passed?' · 复测通过':'')));target.append(b);
   }
  }else{
   const filtered=answers.filter(a=>(status==='all'||(status==='noted'?hasNote(publicNote(a.id).note):status==='unmastered'?!publicNote(a.id).mastered:status==='understood'?publicNote(a.id).mastered:true))&&matches(a,[a.title,a.paper,a.number,a.subject,a.summary,a.answer,a.question?.stem,a.question?.prompt,...(a.question?.options||[]).map(o=>o.text),...a.sections.map(s=>s.heading+' '+s.body),publicNote(a.id).note].join(' ')));
   $('#qa-results').textContent=loadState==='ready'?`${filtered.length} 道 / 共 ${answers.length} 道`:answers.length?`${filtered.length} 道已加载 · ${loadState==='error'?'刷新失败':'正在核对'}`:'暂未加载题目';
   if(!filtered.length&&loadState==='ready')target.append(answers.length?filteredEmpty('没有符合条件的错题','可以换个关键词，或清除筛选查看全部。'):empty('还没有收录错题','把试卷名称和题号发给张菁伟，必要时附上截图。核对原题后，错题与解析会一起更新在这里。你回来复习、记错因就好。'));
   const queue=filtered.map(a=>a.id);
   for(const a of filtered){const note=publicNote(a.id),b=button('','knowledge-card qa-card',()=>openAnswer(a,undefined,[...queue])),meta=el('div','qa-meta');b.dataset.answerId=a.id;meta.append(el('span','',a.subject),el('span','qa-badge '+(note.mastered?'understood':'answered'),note.mastered?'已弄懂':'待复习'),verificationBadge(a));if(hasNote(note.note))meta.append(el('span','qa-badge noted','有复盘笔记'));b.append(meta,el('h3','',a.title),paragraph(label(a)),el('span','card-state','核对日期 '+a.reviewedAt+' · 查看讲解与记笔记'));target.append(b);}
  }
 }
 function inputField(form,key,title,options={}){
  const wrapper=el('label','qa-field'+(options.wide?' wide':''));wrapper.append(el('span','',title));
  const input=el(options.multiline?'textarea':key==='subject'?'select':'input');input.id='qa-entry-'+key;input.name=key;
  if(key==='subject'){for(const v of ['行测','申论']){const option=el('option','',v);option.value=v;input.append(option);}}
  else{input.placeholder=options.placeholder||'';input.maxLength=options.max||200;if(options.multiline)input.rows=options.rows||3;else input.type='text';}
  input.required=!!options.required;input.value=form.values[key]||'';wrapper.append(input);if(options.hint)wrapper.append(el('small','',options.hint));form.inputs[key]=input;form.grid.append(wrapper);
 }
 function newQuestion(){
  const recent=Object.values(state().questions||{}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
  const draft=state().questionDraft;
  const content=openModal('记一道题'),form=el('form','qa-form'),values=draft?{...blank(),...draft}:{...blank(),paper:recent?.paper||'',subject:recent?.subject||'行测'};
  const grid=el('div','qa-form-grid'),inputs={},f={grid,inputs,values};
  form.append(paragraph('只填试卷和题号，先把不会的记下来。','qa-quick-hint'),grid);
  inputField(f,'paper','哪套试卷',{wide:true,required:true,max:200,placeholder:'例如：2025 国考执法卷',hint:!draft&&recent?'已沿用上次试卷，换卷时改一下。':null});
  inputField(f,'number','第几题',{required:true,max:40,placeholder:'例如：32'});
  inputField(f,'subject','科目');
  const more=el('details','qa-optional'),moreGrid=el('div','qa-form-grid');more.append(el('summary','','补充疑问或题目（选填）'),moreGrid);
  const extra={grid:moreGrid,inputs,values};
  inputField(extra,'doubt','哪里没懂',{wide:true,multiline:true,max:5000,rows:2,placeholder:'想补充再写，也可以微信说。'});
  inputField(extra,'myAnswer','我的选择 / 作答',{wide:true,multiline:true,max:500,rows:2,placeholder:'例如：我选 B，答案是 D。'});
  inputField(extra,'source','资料版本 / 平台',{wide:true,max:500,placeholder:'例如：粉笔回忆版（可不填）'});
  inputField(extra,'stem','题目文字',{wide:true,multiline:true,max:30000,rows:3,placeholder:'可直接粘贴；截图在微信另发。'});
  if(['doubt','myAnswer','source','stem'].some(k=>values[k]))more.firstChild?.append(el('span','qa-optional-filled',' · 有已填内容'));
  form.append(more);
  const saved=el('p','save-status','自动保存草稿'),actions=el('div','qa-actions qa-quick-actions');saved.setAttribute('role','status');
  const read=()=>Object.fromEntries(fields.map(k=>[k,inputs[k].value]));
  form.addEventListener('input',()=>saveDraft(read(),saved));
  const save=async copy=>{
   if(!form.reportValidity())return;
   const q=read();for(const k of fields)q[k]=q[k].trim();if(!q.paper||!q.number){saved.textContent='填一下试卷和题号就好。';saved.classList.add('error');return;}
   const existing=Object.entries(state().questions||{}).find(([,x])=>identity(x)===identity(q)&&x.doubt===q.doubt&&x.stem===q.stem&&x.myAnswer===q.myAnswer);
   const id=existing?.[0]||'qa-'+crypto.randomUUID();
   const createdAt=new Date().toISOString();
   if(!reliable('create:'+id,()=>saveQuestion(localStorage,id,q),s=>{s.questions[id]={...q,note:'',mastered:false,createdAt,updatedAt:createdAt,...s.questions[id]};},saved)){showCopy(questionMessage(id,q),'问题未存入设备，请先备份');toast('编号与内容暂留当前页面，可到“我的”备份；请勿刷新或关闭页面');return;}
   saveDraft(null);render();openQuestion(id);toast(existing?'这道题已经记下了':'已保存到临时记题');
   if(copy)await copyMessage(id);
  };
  const saveBtn=el('button','primary-btn','保存到临时记题');saveBtn.type='submit';form.onsubmit=e=>{e.preventDefault();save(false);};
  actions.append(saveBtn,button('给张菁伟发微信~qaq','text-btn',()=>save(true)));form.append(saved,actions);content.append(form);
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
  content.append(block);return {block,area};
 }
 function openQuestion(id){
  const q=state().questions?.[id];if(!q)return;
  const content=openModal('临时记题'),links=matched(id);content.append(el('h3','qa-title',label(q)),paragraph([q.subject,q.source].filter(Boolean).join(' · '),'muted'),paragraph('答疑编号：'+id,'qa-id'));
  const actions=el('div','qa-actions');actions.append(button('给张菁伟发微信~qaq','primary-btn',()=>copyMessage(id)),button('查看待发送文字','quiet-btn',()=>showCopy(questionMessage(id,state().questions[id]))));content.append(actions,paragraph('点击上方按钮复制问题，再到微信粘贴发给张菁伟。解析发布时会按答疑编号关联到这里。','qa-notice'));
  if(q.doubt)content.append(el('h3','','我卡住的地方'),paragraph(q.doubt));if(q.myAnswer)content.append(el('h3','','我的选择 / 作答'),paragraph(q.myAnswer));
  if(q.stem){const details=el('details','qa-stem');details.append(el('summary','','查看原题文字'),paragraph(q.stem));content.append(details);}
  const answerBox=el('section','qa-answer-links');answerBox.append(el('h3','','这道题的解析'));
  if(links.length)for(const a of links)answerBox.append(button(a.title+' →','qa-answer-link',()=>openAnswer(a,id)));
  else answerBox.append(paragraph(loadState==='ready'?(answers.some(a=>a.requestIds.includes(id))?'发现同编号解析，但试卷信息不一致。请发给张菁伟核对后再看，避免看错题。':'还没有发布。把题目发给他，整理好的解析会出现在这里。'):'公开解析尚未加载成功，请关闭弹窗后重新加载。'));
  content.append(answerBox);
  noteEditor(content,q.note,(note,feedback)=>saveNote('question',id,note,feedback),{mastered:q.mastered,onMastered:(mastered,feedback)=>{const ok=commit(()=>saveQuestion(localStorage,id,{mastered}),feedback);render();return ok;}});
 }
 function openPractice(a,answerQueue=[a.id]){
  if(!a)return;
  if(tab!=='practice')setTab('practice');
  const queue=[...answerQueue],index=queue.indexOf(a.id),footer=el('div','qa-reader-footer'),pager=el('div','qa-reader-pager');
  const move=step=>{const next=answers.find(item=>item.id===queue[index+step]);if(next)openPractice(next,queue);};
  const previous=button('上一题','quiet-btn',()=>move(-1)),next=button('跳过此题','quiet-btn',()=>move(1));
  previous.disabled=index<=0;next.disabled=index<0||index>=queue.length-1;
  pager.append(previous,el('span','qa-reader-position',`${index+1} / ${queue.length}`),next);footer.append(pager);
  const content=openModal('独立重做',{reader:true,footer});content.dataset.answerId=a.id;
  content.append(el('h3','qa-title',label(a)),verificationNotice(a));
  // No explanation, title, source annotation, previous answer or private note is
  // inserted in the DOM until a choice is submitted. Those can contain spoilers.
  const q=a.question;
  if(!q||!q.options?.length){content.append(paragraph('题面或选项尚未补齐，暂不能独立作答。'),button('阅读现有解析','quiet-btn',()=>openAnswer(a)));return;}
  const form=el('form','qa-practice-form'),question=el('section','qa-original');form.id='qa-practice-form';
  question.append(paragraph(q.stem,'qa-copy qa-original-stem'));if(q.prompt)question.append(paragraph(q.prompt,'qa-copy qa-question-prompt'));
  const options=el('fieldset','qa-choice-list');options.append(el('legend','','选择本次答案'));
  let selectedOption=null,confidence=null;
  for(const option of q.options){
   const row=el('label','qa-choice'),input=el('input');input.type='radio';input.name='practice-option';input.value=option.label;input.required=true;
   input.onchange=()=>{selectedOption=option.label;submit.disabled=false;};
   row.append(input,el('span','qa-option-label',option.label),el('span','qa-option-text',option.text));options.append(row);
  }
  const confidenceBox=el('fieldset','qa-confidence');confidenceBox.append(el('legend','','这次有多确定（选填）'));
  for(const[value,text]of [['','不记录'],['sure','确定'],['unsure','犹豫'],['guess','猜测']]){
   const row=el('label'),input=el('input');input.type='radio';input.name='practice-confidence';input.value=value;input.checked=!value;input.onchange=()=>{confidence=value||null;};row.append(input,el('span','',text));confidenceBox.append(row);
  }
  const saved=paragraph('先选一个选项，再提交查看答案与解析。','save-status');saved.setAttribute('role','status');
  const submit=el('button','primary-btn qa-practice-submit','提交并查看解析');submit.type='submit';submit.setAttribute('form',form.id);submit.disabled=true;
  const attemptId='attempt-'+crypto.randomUUID();let submittedAt;
  form.onsubmit=e=>{
   e.preventDefault();if(!selectedOption)return;submittedAt||=new Date();
   const ok=commit(()=>recordReviewAttempt(localStorage,a,{selectedOption,confidence,attemptId},submittedAt),saved);
   if(!ok)return;
   const attempt=state().reviewAttempts[a.id].find(item=>item.id===attemptId);
   render();openAnswer(a,undefined,queue,attempt);
  };
  form.append(question,options,confidenceBox,saved);content.append(form);footer.append(submit);
 }
 function openAnswer(a,requestId,answerQueue=[a.id],attempt=null){
  // The queue belongs to this reading session, not the live filters or mastery state.
  const queue=[...answerQueue],index=queue.indexOf(a.id),tools=el('nav','qa-reader-tools'),footer=el('div','qa-reader-footer'),pager=el('div','qa-reader-pager'),feedback=paragraph('','qa-reader-status');
  tools.setAttribute('aria-label','题目阅读导航');feedback.setAttribute('role','status');
  const leave=action=>{try{flush();feedback.textContent='';feedback.classList.remove('error');action();return true;}catch(e){feedback.textContent='尚未切换：'+e.message;feedback.classList.add('error');return false;}};
  const move=step=>{const next=answers.find(item=>item.id===queue[index+step]);if(!next){feedback.textContent='这道题暂时无法读取，请先返回列表重新加载。';return;}leave(()=>attempt?openPractice(next,queue):openAnswer(next,undefined,queue));};
  const last=index>=queue.length-1;
  const previous=button('上一题','quiet-btn',()=>move(-1)),next=button(attempt?(last?'完成本轮':'继续下一题'):'下一题','primary-btn',()=>attempt&&last?leave(()=>closeModal()):move(1));
  previous.dataset.qaStep='previous';next.dataset.qaStep='next';previous.disabled=index<=0;next.disabled=index<0||(!attempt&&last);
  pager.append(previous,el('span','qa-reader-position',`${index+1} / ${queue.length}`),next);footer.append(pager,feedback);
  const content=openModal(attempt?'本次复测与解析':'题目与解析',{reader:true,tools,footer});content.dataset.answerId=a.id;
  if(requestId)content.append(button('‹ 返回临时记题','text-btn',()=>leave(()=>openQuestion(requestId))));
  const heading=el('h3','qa-title',a.question?label(a):a.title);heading.id='qa-reader-question';
  content.append(heading,paragraph(a.question?a.subject:label(a)+' · '+a.subject,'muted'),paragraph('核对日期 '+a.reviewedAt+' · 学习解析，非官方标准答案','muted'));
  content.append(verificationNotice(a));
  if(attempt){
   const result=el('section','qa-attempt-result');result.setAttribute('role','status');
   const outcome=attempt.correct===null?'已记录 · 暂不判分':attempt.correct?'本次复测通过':'本次答错 · 明天再复习';
   const progress=reviewProgress(a,state());
   result.append(el('h3','',outcome),paragraph(`本次选择 ${attempt.selectedOption} · ${{sure:'确定',unsure:'犹豫',guess:'猜测'}[attempt.confidence]||'未记录把握程度'}`));
   if(progress.dueDate)result.append(paragraph('下次复习：'+progress.dueDate));
   result.append(paragraph('已保存本次记录；原有“已弄懂”标记保持独立。','muted'));content.append(result);
  }else content.append(button('独立重做这道题','quiet-btn',()=>leave(()=>openPractice(a,queue))));
  if(a.question){
   const q=a.question,question=el('section','qa-original');question.append(el('h3','','题目'),paragraph(q.stem,'qa-copy qa-original-stem'));
   if(q.prompt)question.append(paragraph(q.prompt,'qa-copy qa-question-prompt'));
   if(q.options.length){const options=el('ol','qa-options');options.setAttribute('aria-label','题目选项');for(const option of q.options){const item=el('li','qa-option');item.append(el('span','qa-option-label',option.label),el('span','qa-option-text',option.text));options.append(item);}question.append(options);}
   if(q.versionNote)question.append(paragraph(q.versionNote,'muted qa-version-note'));
   content.append(question);
  }
  const explanation=el('details','qa-explanation');explanation.id='qa-reader-explanation';explanation.open=!!attempt;explanation.append(el('summary','','查看答案与解析'));content.append(explanation);
  if(a.summary)explanation.append(paragraph(a.summary,'qa-notice'));
  explanation.append(el('h3','','答案 / 作答要点'),paragraph(a.answer));for(const s of a.sections)explanation.append(el('h3','',s.heading),paragraph(s.body));
  if(a.question){const ask=el('a','quiet-btn','还没懂？问 AI');ask.href='./ai.html?question='+encodeURIComponent(a.id);explanation.append(ask);}
  const attempts=state().reviewAttempts?.[a.id]||[];
  if(attempts.length){
   const history=el('details','qa-attempt-history');history.append(el('summary','','本机作答记录（最近5次）'));
   for(const item of attempts.slice(-5).reverse())history.append(paragraph(`${item.localDate} · 选择 ${item.selectedOption} · ${{sure:'确定',unsure:'犹豫',guess:'猜测'}[item.confidence]||'未记录把握程度'}`));
   history.append(paragraph('保留作答时的选择；当前是否通过与到期安排以最新核验为准。','muted'));content.append(history);
  }
  if(a.sources.length){const details=el('details','reader-sources');details.append(el('summary','','原题与核对来源'));for(const s of a.sources){if(!/^https?:\/\//.test(s.url))continue;const link=el('a','qa-source-link',s.title+' ↗');link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';details.append(link);}content.append(details);}
  // When opened from a local question, keep its existing reflection beside the explanation.
  let editor;
  if(requestId){const q=state().questions[requestId];editor=noteEditor(content,q.note,(note,feedback)=>saveNote('question',requestId,note,feedback),{mastered:q.mastered,onMastered:(mastered,feedback)=>{const ok=commit(()=>saveQuestion(localStorage,requestId,{mastered}),feedback);render();return ok;}});}
  else {const note=publicNote(a.id);editor=noteEditor(content,note.note,(value,feedback)=>saveNote('answer',a.id,value,feedback),{mastered:note.mastered,onMastered:(mastered,feedback)=>{const ok=commit(()=>saveAnswerNote(localStorage,a.id,{mastered}),feedback);render();return ok;}});}
  editor.block.id='qa-reader-note';
  const jumps=[],selectJump=key=>jumps.forEach(b=>{const active=b.dataset.qaJump===key;b.className='qa-reader-jump'+(active?' active':'');b.setAttribute('aria-pressed',String(active));});
  const jump=(key,text,target,before)=>{const b=button(text,'qa-reader-jump',()=>{selectJump(key);if(before)before();target.scrollIntoView({block:'start',behavior:'auto'});});b.dataset.qaJump=key;b.setAttribute('aria-controls',target.id);jumps.push(b);return b;};
  tools.append(jump('question','题目',heading),jump('explanation','看解析',explanation,()=>{explanation.open=true;}),jump('note','记笔记',editor.block,()=>editor.area.focus({preventScroll:true})));selectJump('question');
 }
 $('#qa-new').onclick=newQuestion;$('#qa-draft-hint').onclick=newQuestion;$('#qa-refresh').onclick=loadAnswers;
 document.querySelectorAll('[data-qa-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.qaTab));
 $('#qa-search').oninput=e=>{query=e.target.value;render();};$('#qa-status').onchange=e=>{status=e.target.value;render();};
 $('#qa-paper').onchange=e=>{paper=e.target.value;render();};$('#qa-reset').onclick=resetFilters;
 // Recompute dates after a background tab resumes or crosses local midnight.
 let day=localDate();const refreshDay=()=>{const today=localDate();if(today!==day){day=today;render();}};
 document.addEventListener?.('visibilitychange',refreshDay);
 globalThis.addEventListener?.('focus',refreshDay);
 if(typeof window!=='undefined')window.setInterval(refreshDay,60000);
 loadAnswers();return {render,newQuestion,flush,snapshot,hasUnsaved:()=>unsaved.size>0};
}
