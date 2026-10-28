import {loadStudy,saveAnswerNote} from './storage.js?v=20261020-review2';
import {getVerification} from './review.js?v=20261020-review2';
import {parseVerbalSource,rawSourceUrl} from './verbal-source-parser.js?v=20261023-audit1';
import {adaptSourceQuestion,submissionResult,hasMistake,plainQuestion,persistPracticeRound,retryPendingRounds,hasPendingRounds,reconcileNoteDraft} from './verbal-practice-model.js?v=20261028-explanations';
import {withExplanation} from './verbal-explanations.js?v=20261028-explanations';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const btn=(text,cls,fn)=>{const n=el('button',cls,text);n.type='button';n.onclick=fn;return n;};
const sourceUrl=value=>{try{return rawSourceUrl(value);}catch{return null;}};
const matches=(q,s)=>q.part===s.part&&(s.exam==='all'||q.exam===s.exam)&&(s.year==='all'||q.year===Number(s.year))&&(!s.query||(/^第?\s*\d+\s*题?$/.test(s.query.trim())?Number(q.number)===Number(s.query.replace(/\D/g,'')):[q.paper,q.question.stem,q.subtype].join(' ').toLowerCase().includes(s.query.trim().toLowerCase())));
function appendSegments(node,segments){for(const s of segments||[]){if(s.type==='image'){const img=el('img','practice-material-image');img.src=s.url;img.alt=s.alt||'题目配图';img.loading='lazy';img.referrerPolicy='no-referrer';node.append(img);}else node.append(el('p','practice-text',s.text));}}
export function createPractice({bank,answers,explanations,mount,toast,onCount}){
 const known=bank.explained.map(m=>({...answers.get(m.answerId),part:m.part,exam:m.exam,year:m.year,subtype:m.subtype})).filter(q=>q.question?.stem&&q.question.options?.length>=2);
 const loaded=new Map(),rounds=new Map();let filters,selected='known',queue=[],position=0,sequence=0,study,storageError='',noteDraft=null,noteEditor=null,loadingPaper=null;
 function read(){try{study=loadStudy(localStorage);storageError='';}catch(e){study=null;storageError=e.message;}}
 function count(text){onCount(text);}
 const availablePapers=()=>bank.papers.filter(p=>sourceUrl(p.url)&&(filters.exam==='all'||p.exam===filters.exam)&&(filters.year==='all'||p.year===Number(filters.year))&&bank.items.some(q=>q.part===filters.part&&q.occurrences.some(o=>o.paperId===p.id)));
 function options(){return known.filter(q=>matches(q,filters));}
 function refreshNoteEditor(){
  if(!noteEditor?.field.isConnected||!study)return;
  const latest=study.answerNotes[noteEditor.id]?.note||'';
  if(noteDraft?.id===noteEditor.id){if(latest!==noteDraft.baseValue)noteEditor.status.textContent='另一页面也修改了笔记；保存时会保留两份内容。';return;}
  noteEditor.field.value=latest;noteEditor.baseValue=latest;
 }
 function saveDraft(quiet=false){if(!noteDraft)return true;try{
  const latest=loadStudy(localStorage),merged=reconcileNoteDraft(noteDraft,latest.answerNotes[noteDraft.id]?.note||'');
  study=saveAnswerNote(localStorage,noteDraft.id,{note:merged.value});noteDraft=null;refreshNoteEditor();
  if(noteEditor)noteEditor.status.textContent=merged.conflict?'已保留两边修改，请检查合并后的笔记。':'笔记已保存到此设备。';
  if(merged.conflict&&!quiet)toast('检测到另一页面的修改，已保留两边笔记。');return true;
 }catch(e){if(!quiet)toast('笔记尚未保存：'+e.message);if(noteEditor)noteEditor.status.textContent='尚未保存：'+e.message;return false;}}
 function flush(quiet=false){
  let result={ok:true,failures:[]};if(hasPendingRounds(rounds.values()))try{result=retryPendingRounds(localStorage,rounds.values());if(result.state)study=result.state;}catch(e){result={ok:false,failures:[{error:e.message}]};}
  const notesSaved=saveDraft(quiet);
  if(!result.ok&&!quiet)toast('作答尚未保存，请先重试或备份，暂不离开：'+result.failures[0].error);
  return result.ok&&notesSaved;
 }
 const hasUnsaved=()=>!!noteDraft||hasPendingRounds(rounds.values());
 function picker(){
  const box=el('section','practice-picker'),source=bank.papers.find(p=>p.id===selected),papers=availablePapers(),isLoading=loadingPaper?.id===selected;
  const shortTitle=p=>p.exam==='guokao'?p.year+' 国考 · '+(p.title.includes('行政执法')?'行政执法':p.title.includes('副省')?'副省级':p.title.includes('地市')?'地市级':'综合卷'):p.year+' 福建省考';
  const title=selected==='known'?'精选练习':source?shortTitle(source):'请选择试卷';
  const paperCount=id=>bank.items.reduce((total,item)=>total+(item.part===filters.part?item.occurrences.filter(o=>o.paperId===id).length:0),0);
  const currentCount=selected==='known'?options().length:loaded.has(selected)?loaded.get(selected).filter(q=>matches(q,filters)).length:paperCount(selected);
  const heading=el('div','practice-paper-heading'),info=el('div','practice-paper-info');
  const label=el('span','practice-paper-label','当前试卷'),currentTitle=el('h2','practice-paper-title',title);if(source)currentTitle.title=source.title;info.append(label,currentTitle);
  info.append(el('p','practice-paper-meta',(source?source.year+' 年 · ':'')+filters.part+' · '+currentCount+' 题'));
  const switcher=btn('切换试卷','primary-btn practice-paper-switch',()=>setOpen(panel.hidden));
  switcher.setAttribute('aria-expanded','false');switcher.setAttribute('aria-controls','practice-paper-panel');heading.append(info,switcher);box.append(heading);
  const panel=el('section','practice-paper-panel');panel.id='practice-paper-panel';panel.hidden=true;panel.setAttribute('aria-label','选择要做的试卷');
  const searchLabel=el('label','practice-paper-search','查找试卷'),search=el('input');search.type='search';search.placeholder='例如：2023 行政执法';search.autocomplete='off';searchLabel.append(search);
  const controls=el('div','practice-paper-filters'),examLabel=el('label','','考试'),exam=el('select'),yearLabel=el('label','','年份'),year=el('select');
  const addOption=(node,value,text)=>{const option=el('option','',text);option.value=value;node.append(option);};
  addOption(exam,'all','全部考试');for(const [id,name]of [['guokao','国考'],['fujian','福建省考']])if(papers.some(p=>p.exam===id))addOption(exam,id,name);
  addOption(year,'all','全部年份');for(const value of [...new Set(papers.map(p=>p.year))].sort((a,b)=>b-a))addOption(year,String(value),value+' 年');
  examLabel.append(exam);yearLabel.append(year);controls.append(examLabel,yearLabel);const results=el('div','practice-paper-list'),status=el('p','practice-paper-count');status.setAttribute('role','status');
  const close=btn('收起选卷','text-btn practice-paper-close',()=>setOpen(false));panel.append(searchLabel,controls,status,results,close);box.append(panel);
  function setOpen(open){panel.hidden=!open;switcher.setAttribute('aria-expanded',String(open));switcher.textContent=open?'收起选卷':'切换试卷';if(open){drawPapers();search.focus();}else switcher.focus();}
  function selectPaper(id){
   if(!flush())return;
   if(id===selected){setOpen(false);if(id!=='known'&&!loaded.has(id)&&!isLoading)startPaperLoad(id);return;}
   ++sequence;loadingPaper=null;selected=id;position=0;rounds.clear();render();mount.querySelector('.practice-paper-switch')?.focus({preventScroll:true});
   if(id!=='known'&&!loaded.has(id))startPaperLoad(id);
  }
  function drawPapers(){
   results.replaceChildren();const words=search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
   const visible=papers.filter(p=>(exam.value==='all'||exam.value===p.exam)&&(year.value==='all'||Number(year.value)===p.year)&&words.every(w=>[p.title,p.year,p.exam==='guokao'?'国考':'福建省考'].join(' ').toLowerCase().includes(w)));
   const addPaper=(id,name,detail)=>{const button=btn('','practice-paper-choice'+(selected===id?' is-current':''),()=>selectPaper(id));button.setAttribute('aria-pressed',String(selected===id));button.append(el('strong','',name),el('span','',detail),el('b','practice-paper-action',selected===id?'继续做':loaded.has(id)||id==='known'?'开始做':'选择并载入'));results.append(button);};
   if(!words.length&&exam.value==='all'&&year.value==='all')addPaper('known','精选练习',filters.part+' · '+options().length+' 题');
   for(const p of visible)addPaper(p.id,shortTitle(p),filters.part+' '+paperCount(p.id)+' 题 · 公开回忆版');
   status.textContent='找到 '+visible.length+' 份试卷 · 点选后直接开始';
   if(!results.childElementCount)results.append(el('p','muted','没有匹配的试卷，试试缩短关键词或更换年份。'));
  }
  search.oninput=drawPapers;exam.onchange=drawPapers;year.onchange=drawPapers;panel.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);}};
  if(selected!=='known'&&!loaded.has(selected)){
   const state=el('p','practice-paper-state',isLoading?'正在载入题目，请稍候…':'初次载入需要网络。没有显示题目时，可点击下方重新载入。');state.setAttribute('role','status');box.append(state);
   const load=btn(isLoading?'正在载入…':'载入题目','quiet-btn practice-load-button',()=>startPaperLoad(selected));load.disabled=isLoading;box.append(load);
  }else box.append(el('span','practice-paper-ready',selected==='known'?'可直接开始':'已载入 · 可直接开始'));
  if(filters.exam==='shiye')box.append(el('p','muted','福建事业单位原卷暂未接通可做题数据，可切到国考或福建省考练习。'));
  return box;
 }
 async function startPaperLoad(id){
  if(loadingPaper?.id===id)return;
  if(!flush())return;const ticket={id};loadingPaper=ticket;render();mount.querySelector('.practice-paper-switch')?.focus({preventScroll:true});
  try{await loadPaper(id);}finally{if(loadingPaper===ticket){const restoreFocus=document.activeElement===document.body||document.activeElement?.classList.contains('practice-paper-switch');loadingPaper=null;render();if(restoreFocus)mount.querySelector('.practice-paper-switch')?.focus({preventScroll:true});}}
 }
 async function loadPaper(id){if(!flush())return;const token=++sequence,paper=bank.papers.find(p=>p.id===id),url=sourceUrl(paper?.url);if(!url)return;count('正在载入题干与选项…');const loadButton=mount.querySelector('.practice-load-button');if(loadButton)loadButton.disabled=true;
  try{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),22000);let md;try{const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('来源返回 '+response.status);md=await response.text();}finally{clearTimeout(timeout);}if(md.length>2000000)throw Error('试卷文件过大');const rows=bank.items.flatMap(item=>item.occurrences.filter(o=>o.paperId===id).map(o=>({item,o}))).sort((a,b)=>a.o.moduleNumber-b.o.moduleNumber);
   const bindings=rows.map(({o})=>({qid:String(o.qid),moduleNumber:o.moduleNumber,materialGroupId:o.materialGroupId}));const result=parseVerbalSource(md,{sourceUrl:url,expectedTitle:paper.title,expectedYear:paper.year,expectedCount:rows.length,bindings});const qs=[];
   for(const row of rows){const q=result.questions.find(q=>String(q.qid)===String(row.o.qid)&&q.moduleNumber===row.o.moduleNumber);if(q?.sourceTextComplete&&q.referenceAnswer?.value)qs.push(withExplanation(adaptSourceQuestion(q,row.item,row.o,paper),explanations));}
   if(!qs.length)throw Error('没有识别到完整题面与答案，已停止载入');if(token!==sequence)return;if(!flush()){if(loadButton)loadButton.disabled=false;return;}loaded.set(id,qs);position=0;toast('已载入 '+qs.length+' 道；不完整或答案冲突的题已跳过。');render();
  }catch(e){if(token!==sequence)return;count('题目未载入');toast('暂时无法读取原卷：'+(e.name==='AbortError'?'网络超时':e.message)+'。可先做“精选练习”。');if(loadButton)loadButton.disabled=false;}
 }
 function mistakeList(){read();const box=el('section','practice-mistakes');if(!study){box.append(el('p','warning','无法读取本机记录：'+storageError));return box;}const all=[...known,...[...loaded.values()].flat()],unique=[...new Map(all.map(q=>[q.id,q])).values()];const wrong=[...new Map(all.filter(q=>matches(q,filters)&&hasMistake(q,study)).map(q=>[q.id,q])).values()];count(wrong.length+' 道已载入错题');box.append(el('p','muted','保留曾经答错的题，复测通过后仍可回看。历年卷按来源参考答案比较；精选题中的已核对题按本站答案判分，有争议题不判对错。'));
  for(const q of wrong){const c=el('article','bank-item');c.append(el('h2','',q.paper+' · '+(q.sourceOnly?'模块':'第')+q.number+' 题'),btn('重新做这题','primary-btn',()=>{if(!flush())return;++sequence;selected=q.sourceOnly?q.paperId:'known';queue=[q];position=0;rounds.delete(q.id);renderQuestionOnly();}));box.append(c);}
  const remoteIds=new Set(bank.items.map(q=>q.id)),unloaded=Object.keys(study.reviewAttempts).filter(id=>remoteIds.has(id)&&!unique.some(q=>q.id===id));if(unloaded.length){box.append(el('h2','','以前练过的试卷'));const paperIds=[...new Set(bank.items.filter(q=>unloaded.includes(q.id)&&q.part===filters.part).flatMap(q=>q.occurrences.map(o=>o.paperId)))];for(const id of paperIds){const p=bank.papers.find(p=>p.id===id);if(p&&sourceUrl(p.url)&&(filters.exam==='all'||p.exam===filters.exam)&&(filters.year==='all'||p.year===Number(filters.year)))box.append(btn('读取记录对应试卷：'+p.title,'quiet-btn',()=>loadPaper(id)));}}
  if(!wrong.length)box.append(el('p','','当前范围暂无已载入的错题。先做题；刷新后可点击上方对应试卷重新读取题面，记录仍保存在此设备。'));return box;
 }
 function questionView(){const q=queue[position],box=el('article','practice-question');if(!q){box.append(el('h2','','这里暂时没有可做的题'),el('p','','请选择其他试卷或调整筛选。只有题干和选项完整的题才会进入练习。'));count('0 道可做');return box;}
  let r=rounds.get(q.id);if(!r){r={answer:q,choice:null,submitted:false,saved:false,attemptId:'attempt-'+crypto.randomUUID(),at:null};rounds.set(q.id,r);}count('第 '+(position+1)+' / '+queue.length+' 题');
  const progress=el('div','practice-progress'),track=el('progress');track.max=queue.length;track.value=position+1;track.setAttribute('aria-label','当前题目位置');progress.append(el('strong','','第 '+(position+1)+' / '+queue.length+' 题'),track);box.append(progress);
  if(queue.length>1){const jump=el('details','practice-jump'),grid=el('div','practice-jump-grid');jump.append(el('summary','','选题 · '+queue.filter(item=>rounds.get(item.id)?.submitted).length+' 题已提交'));grid.setAttribute('aria-label','题目导航');for(const[itemIndex,item]of queue.entries()){const b=btn(String(itemIndex+1),'quiet-btn'+(rounds.get(item.id)?.submitted?' answered':''),()=>{if(!flush())return;position=itemIndex;draw();mount.querySelector('.practice-question')?.scrollIntoView({block:'start'});});b.setAttribute('aria-label','跳到第 '+(itemIndex+1)+' 题'+(rounds.get(item.id)?.submitted?'，已提交':''));if(itemIndex===position)b.setAttribute('aria-current','step');grid.append(b);}jump.append(grid);box.append(jump);}
  box.append(el('div','practice-qmeta',q.part+' · '+q.subtype),el('h2','',q.paper+' · '+(q.sourceOnly?'言语模块第 ':'第 ')+q.number+' 题'));
  if(q.sourceOnly&&sourceUrl(q.sourceUrl)){const original=el('a','muted','当前试卷来源 ↗');original.href=q.sourceUrl;original.target='_blank';original.rel='noopener noreferrer';box.append(original);}
  if(q.sourceOnly)box.append(el('p','muted','模块序号不等于原卷题号 · 回忆版'));if(q.displayMaterial?.length){const material=el('section','practice-material');material.append(el('h3','','阅读材料'));appendSegments(material,q.displayMaterial);box.append(material);}if(q.displayStem)appendSegments(box,q.displayStem);else box.append(el('p','practice-text',q.question.stem));if(q.question.prompt)box.append(el('p','practice-prompt',q.question.prompt));
  const choices=el('div','practice-options');choices.setAttribute('role','radiogroup');choices.setAttribute('aria-label','选择答案');for(const o of q.question.options){const b=btn('','practice-option'+(r.choice===o.label?' selected':''),()=>{r.choice=o.label;draw();});b.setAttribute('role','radio');b.setAttribute('aria-checked',String(r.choice===o.label));b.disabled=r.submitted;const letter=el('b','practice-letter',o.label),text=el('div');const display=q.displayOptions?.find(x=>x.label===o.label);if(display)appendSegments(text,display.segments);else text.append(el('span','',o.text));b.append(letter,text);choices.append(b);}box.append(choices);
  const save=()=>{if(!r.choice)return;try{const result=persistPracticeRound(localStorage,q,r);if(result.state)study=result.state;}catch(e){r.at=r.at||new Date();r.submitted=true;r.saved=false;r.error=e.message;}draw();mount.querySelector('.practice-feedback')?.scrollIntoView({block:'start'});};
  if(!r.submitted){if(storageError)box.append(el('p','warning','本机记录无法读取，提交后可能无法保存：'+storageError));}
  else{const result=submissionResult(q,r.choice),panel=el('section','practice-feedback '+result.kind);const headings={correct:'答对了',incorrect:'这题答错了','reference-match':'与来源参考答案一致','reference-different':'与来源参考答案不同',disputed:'答案有争议，先看依据',ungraded:'本题暂不判分'};panel.append(el('h3','',headings[result.kind]),el('p','','你的选择：'+r.choice+(q.correctOption?'；'+(q.sourceOnly?'来源参考答案':'本站核对答案')+'：'+q.correctOption:'')));if(q.sourceOnly)panel.append(el('p','muted',q.explanation?'下面是本站整理的逐题讲解，非官方答案；争议题不判对错，其余按来源参考比较，不计入已核对正确率。':'来源答案尚未完成核验，只记录选择，不计入本站已核对正确率。'));
   if(!r.saved){panel.append(el('p','warning','未保存到设备：'+r.error),btn('重试保存','quiet-btn',save));}else panel.append(el('p','muted',['incorrect','reference-different'].includes(result.kind)?'已记录在本板块“我的错题”。':'作答已保存到此设备。'));
   if(q.sections?.length){panel.append(el('h3','','解析'));if(q.answer)panel.append(el('p','practice-text',q.answer));for(const s of q.sections){panel.append(el('h4','',s.heading),el('p','practice-text',s.body));}}
   else panel.append(el('p','','当前题面版本未匹配到解析。请刷新后重试，或把这一题发给张菁伟核对。'));
   if(q.verification.status==='disputed')panel.append(el('p','warning',getVerification(q).note));
   const ask=btn('给张菁伟发微信~qaq','quiet-btn',async()=>{try{await navigator.clipboard.writeText(plainQuestion(q)+'\n我的选择：'+r.choice+'\n我的疑问：'+(noteDraft?.id===q.id?noteDraft.value:study?.answerNotes[q.id]?.note||''));toast('已复制题目和疑问，请粘贴到微信。');}catch{toast('复制失败，可截图发微信。');}});panel.append(ask);box.append(panel);
   const note=el('section','practice-note'),field=el('textarea'),status=el('p','save-status','笔记只保存在此设备');field.rows=3;field.maxLength=100000;field.setAttribute('aria-label','这道题的错因或笔记');field.placeholder='简单记一句：错在哪、下次怎么判断';
   const latest=study?.answerNotes[q.id]?.note||'',editor={id:q.id,field,status,baseValue:noteDraft?.id===q.id?noteDraft.baseValue:latest};noteEditor=editor;field.value=noteDraft?.id===q.id?noteDraft.value:latest;
   const capture=()=>{noteDraft={id:q.id,value:field.value,baseValue:noteDraft?.id===q.id?noteDraft.baseValue:editor.baseValue};};field.oninput=capture;status.setAttribute('role','status');
   note.append(el('h3','','记一句错因'),field,status,btn('保存笔记','quiet-btn',()=>{capture();saveDraft();}));box.append(note);
  }
  if(r.submitted)box.append(btn('重新做本题','text-btn practice-restart',()=>{if(flush()){rounds.delete(q.id);draw();mount.querySelector('.practice-question')?.scrollIntoView({block:'start'});}}));
  const nav=el('div','practice-nav'),prev=btn('上一题','quiet-btn',()=>move(-1)),next=btn(position===queue.length-1?'本轮结束':'下一题',r.submitted?'primary-btn':'quiet-btn',()=>{if(position===queue.length-1){if(flush()){const done=queue.filter(item=>rounds.get(item.id)?.submitted).length;toast('本轮 '+done+' / '+queue.length+' 题已提交；可从上方“选题”补做或更换试卷。');}}else move(1);});prev.disabled=position===0;nav.setAttribute('aria-label','做题操作');nav.append(prev);if(!r.submitted){const submit=btn('提交答案','primary-btn practice-submit',save);submit.disabled=!r.choice;nav.append(submit);}else nav.append(el('span','practice-nav-position',(position+1)+' / '+queue.length));nav.append(next);box.append(nav);return box;
 }
 function move(delta){if(!flush())return;position+=delta;draw();mount.querySelector('.practice-question')?.scrollIntoView({block:'start'});}
 function draw(){const old=mount.querySelector('.practice-question');if(old)old.replaceWith(questionView());else mount.append(questionView());}
 function renderQuestionOnly(){noteEditor=null;mount.replaceChildren(picker(),questionView());}
 function render(){read();noteEditor=null;mount.replaceChildren();if(filters.view==='mistakes'){mount.append(mistakeList());return;}const remote=loaded.get(selected)||[];queue=(selected==='known'?known:remote).filter(q=>matches(q,filters));position=Math.min(position,Math.max(0,queue.length-1));mount.append(picker());if(selected!=='known'&&!loaded.has(selected)){count('选择试卷后载入题目');return;}mount.append(questionView());}
 function show(state){if(!flush())return false;filters={...state};++sequence;position=0;const allowed=availablePapers();if(selected!=='known'&&!allowed.some(p=>p.id===selected))selected='known';render();return true;}
 const refresh=()=>{read();refreshNoteEditor();};
 addEventListener('beforeunload',e=>{if(hasUnsaved()&&!flush(true)){e.preventDefault();e.returnValue='';}});
 addEventListener('pagehide',()=>{if(hasUnsaved())flush(true);});
 addEventListener('storage',refresh);addEventListener('pageshow',refresh);addEventListener('focus',refresh);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&hasUnsaved())flush(true);});
 document.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(a&&a.target!=='_blank'&&hasUnsaved()&&!flush()){e.preventDefault();}},true);
 return {show,canLeave:()=>{if(!flush())return false;++sequence;return true;},hasUnsaved};
}
