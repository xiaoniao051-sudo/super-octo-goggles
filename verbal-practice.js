import {loadStudy,saveAnswerNote} from './storage.js?v=20261020-review2';
import {getVerification} from './review.js?v=20261020-review2';
import {parseVerbalSource,rawSourceUrl} from './verbal-source-parser.js?v=20261023-practice';
import {adaptSourceQuestion,submissionResult,hasMistake,plainQuestion,persistPracticeRound,retryPendingRounds,hasPendingRounds,reconcileNoteDraft} from './verbal-practice-model.js?v=20261023-practice';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const btn=(text,cls,fn)=>{const n=el('button',cls,text);n.type='button';n.onclick=fn;return n;};
const sourceUrl=value=>{try{return rawSourceUrl(value);}catch{return null;}};
const matches=(q,s)=>q.part===s.part&&(s.exam==='all'||q.exam===s.exam)&&(s.year==='all'||q.year===Number(s.year))&&(!s.query||(/^第?\s*\d+\s*题?$/.test(s.query.trim())?Number(q.number)===Number(s.query.replace(/\D/g,'')):[q.paper,q.question.stem,q.subtype].join(' ').toLowerCase().includes(s.query.trim().toLowerCase())));
function appendSegments(node,segments){for(const s of segments||[]){if(s.type==='image'){const img=el('img','practice-material-image');img.src=s.url;img.alt=s.alt||'题目配图';img.loading='lazy';img.referrerPolicy='no-referrer';node.append(img);}else node.append(el('p','practice-text',s.text));}}
export function createPractice({bank,answers,mount,toast,onCount}){
 const known=bank.explained.map(m=>({...answers.get(m.answerId),part:m.part,exam:m.exam,year:m.year,subtype:m.subtype})).filter(q=>q.question?.stem&&q.question.options?.length>=2);
 const loaded=new Map(),rounds=new Map();let filters,selected='known',queue=[],position=0,sequence=0,study,storageError='',noteDraft=null,noteEditor=null;
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
 function picker(){const box=el('section','practice-picker'),label=el('label','','选择试卷'),select=el('select');select.id='practice-paper';select.setAttribute('aria-label','选择试卷');const add=(id,text)=>{const o=el('option','',text);o.value=id;select.append(o);};
  add('known','本站已有讲解 · '+options().length+' 题');for(const p of availablePapers())add(p.id,p.title);select.value=selected;select.onchange=()=>{if(!flush()){select.value=selected;return;}++sequence;selected=select.value;position=0;rounds.clear();render();};label.append(select);box.append(label);
  if(selected!=='known'&&!loaded.has(selected)){box.append(el('p','muted','点击后在本页读取公开原卷，题干和选项直接显示；初次读取需要网络。'),btn('载入题目，开始做','primary-btn',()=>loadPaper(selected)));}
  if(filters.exam==='shiye')box.append(el('p','muted','福建事业单位原卷暂未接通可做题数据，这里不把题号目录当作题目。'));
  const source=bank.papers.find(p=>p.id===selected);if(source&&loaded.has(selected))box.append(el('p','muted','已载入 '+loaded.get(selected).length+' 道完整题。来源参考答案单独标注，不计入本站已核对正确率。'));return box;
 }
 async function loadPaper(id){if(!flush())return;const token=++sequence,paper=bank.papers.find(p=>p.id===id),url=sourceUrl(paper?.url);if(!url)return;count('正在载入题干与选项…');const loadButton=mount.querySelector('.practice-picker button');if(loadButton)loadButton.disabled=true;
  try{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),22000);let md;try{const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('来源返回 '+response.status);md=await response.text();}finally{clearTimeout(timeout);}if(md.length>2000000)throw Error('试卷文件过大');const rows=bank.items.flatMap(item=>item.occurrences.filter(o=>o.paperId===id).map(o=>({item,o}))).sort((a,b)=>a.o.moduleNumber-b.o.moduleNumber);
   const bindings=rows.map(({o})=>({qid:Number(o.qid),moduleNumber:o.moduleNumber,materialGroupId:o.materialGroupId||null}));const result=parseVerbalSource(md,{sourceUrl:url,expectedCount:rows.length,bindings});const qs=[];
   for(const row of rows){const q=result.questions.find(q=>String(q.qid)===String(row.o.qid)&&q.moduleNumber===row.o.moduleNumber);if(q?.sourceTextComplete&&q.referenceAnswer?.value)qs.push(adaptSourceQuestion(q,row.item,row.o,paper));}
   if(!qs.length)throw Error('没有识别到完整题面与答案，已停止载入');if(token!==sequence)return;if(!flush()){if(loadButton)loadButton.disabled=false;return;}loaded.set(id,qs);position=0;toast('已载入 '+qs.length+' 道；不完整或答案冲突的题已跳过。');render();
  }catch(e){if(token!==sequence)return;count('题目未载入');toast('暂时无法读取原卷：'+(e.name==='AbortError'?'网络超时':e.message)+'。可先做“本站已有讲解”。');if(loadButton)loadButton.disabled=false;}
 }
 function mistakeList(){read();const box=el('section','practice-mistakes');if(!study){box.append(el('p','warning','无法读取本机记录：'+storageError));return box;}const all=[...known,...[...loaded.values()].flat()],unique=[...new Map(all.map(q=>[q.id,q])).values()];const wrong=[...new Map(all.filter(q=>matches(q,filters)&&hasMistake(q,study)).map(q=>[q.id,q])).values()];count(wrong.length+' 道已载入错题');box.append(el('p','muted','保留曾经答错的题，复测通过后仍可回看。历年卷按来源参考答案比较，本站讲解按已核对答案判分。'));
  for(const q of wrong){const c=el('article','bank-item');c.append(el('h2','',q.paper+' · '+(q.sourceOnly?'模块':'第')+q.number+' 题'),btn('重新做这题','primary-btn',()=>{if(!flush())return;++sequence;selected=q.sourceOnly?q.paperId:'known';queue=[q];position=0;rounds.delete(q.id);renderQuestionOnly();}));box.append(c);}
  const remoteIds=new Set(bank.items.map(q=>q.id)),unloaded=Object.keys(study.reviewAttempts).filter(id=>remoteIds.has(id)&&!unique.some(q=>q.id===id));if(unloaded.length){box.append(el('h2','','以前练过的试卷'));const paperIds=[...new Set(bank.items.filter(q=>unloaded.includes(q.id)&&q.part===filters.part).flatMap(q=>q.occurrences.map(o=>o.paperId)))];for(const id of paperIds){const p=bank.papers.find(p=>p.id===id);if(p&&sourceUrl(p.url)&&(filters.exam==='all'||p.exam===filters.exam)&&(filters.year==='all'||p.year===Number(filters.year)))box.append(btn('读取记录对应试卷：'+p.title,'quiet-btn',()=>loadPaper(id)));}}
  if(!wrong.length)box.append(el('p','','当前范围暂无已载入的错题。先做题；刷新后可点击上方对应试卷重新读取题面，记录仍保存在此设备。'));return box;
 }
 function questionView(){const q=queue[position],box=el('article','practice-question');if(!q){box.append(el('h2','','这里暂时没有可做的题'),el('p','','请选择其他试卷或调整筛选。只有题干和选项完整的题才会进入练习。'));count('0 道可做');return box;}
  let r=rounds.get(q.id);if(!r){r={answer:q,choice:null,submitted:false,saved:false,attemptId:'attempt-'+crypto.randomUUID(),at:null};rounds.set(q.id,r);}count('第 '+(position+1)+' / '+queue.length+' 题');
  box.append(el('div','practice-qmeta',q.part+' · '+q.subtype),el('h2','',q.paper+' · '+(q.sourceOnly?'言语模块第 ':'第 ')+q.number+' 题'));
  if(q.sourceOnly&&sourceUrl(q.sourceUrl)){const original=el('a','muted','当前试卷来源 ↗');original.href=q.sourceUrl;original.target='_blank';original.rel='noopener noreferrer';box.append(original);}
  if(q.sourceOnly)box.append(el('p','muted','模块序号不等于原卷题号 · 回忆版'));if(q.displayMaterial?.length){const material=el('section','practice-material');material.append(el('h3','','阅读材料'));appendSegments(material,q.displayMaterial);box.append(material);}if(q.displayStem)appendSegments(box,q.displayStem);else box.append(el('p','practice-text',q.question.stem));if(q.question.prompt)box.append(el('p','practice-prompt',q.question.prompt));
  const choices=el('div','practice-options');choices.setAttribute('role','radiogroup');choices.setAttribute('aria-label','选择答案');for(const o of q.question.options){const b=btn('','practice-option'+(r.choice===o.label?' selected':''),()=>{r.choice=o.label;draw();});b.setAttribute('role','radio');b.setAttribute('aria-checked',String(r.choice===o.label));b.disabled=r.submitted;const letter=el('b','practice-letter',o.label),text=el('div');const display=q.displayOptions?.find(x=>x.label===o.label);if(display)appendSegments(text,display.segments);else text.append(el('span','',o.text));b.append(letter,text);choices.append(b);}box.append(choices);
  const save=()=>{if(!r.choice)return;try{const result=persistPracticeRound(localStorage,q,r);if(result.state)study=result.state;}catch(e){r.at=r.at||new Date();r.submitted=true;r.saved=false;r.error=e.message;}draw();};
  if(!r.submitted){const submit=btn('提交答案','primary-btn practice-submit',save);submit.disabled=!r.choice;box.append(submit);if(storageError)box.append(el('p','warning','本机记录无法读取，提交后可能无法保存：'+storageError));}
  else{const result=submissionResult(q,r.choice),panel=el('section','practice-feedback '+result.kind);const headings={correct:'答对了',incorrect:'这题答错了','reference-match':'与来源参考答案一致','reference-different':'与来源参考答案不同',ungraded:'本题暂不判分'};panel.append(el('h3','',headings[result.kind]),el('p','','你的选择：'+r.choice+(q.correctOption?'；'+(q.sourceOnly?'来源参考答案':'本站核对答案')+'：'+q.correctOption:'')));if(q.sourceOnly)panel.append(el('p','muted','此答案尚未独立核验，只记录选择，不计入本站已核对正确率。'));
   if(!r.saved){panel.append(el('p','warning','未保存到设备：'+r.error),btn('重试保存','quiet-btn',save));}else panel.append(el('p','muted',['incorrect','reference-different'].includes(result.kind)?'已记录在本板块“我的错题”。':'作答已保存到此设备。'));
   if(q.sections?.length){panel.append(el('h3','','解析'));if(q.answer)panel.append(el('p','practice-text',q.answer));for(const s of q.sections){panel.append(el('h4','',s.heading),el('p','practice-text',s.body));}}
   else panel.append(el('p','','这道题暂未有本站逐题解析。可以先记录卡点，再把题目发给张菁伟补充讲解。'));
   if(q.verification.status==='disputed')panel.append(el('p','warning',getVerification(q).note));
   const ask=btn('给张菁伟发微信~qaq','quiet-btn',async()=>{try{await navigator.clipboard.writeText(plainQuestion(q)+'\n我的选择：'+r.choice+'\n我的疑问：'+(noteDraft?.id===q.id?noteDraft.value:study?.answerNotes[q.id]?.note||''));toast('已复制题目和疑问，请粘贴到微信。');}catch{toast('复制失败，可截图发微信。');}});panel.append(ask);box.append(panel);
   const note=el('section','practice-note'),field=el('textarea'),status=el('p','save-status','笔记只保存在此设备');field.rows=3;field.maxLength=100000;field.setAttribute('aria-label','这道题的错因或笔记');field.placeholder='简单记一句：错在哪、下次怎么判断';
   const latest=study?.answerNotes[q.id]?.note||'',editor={id:q.id,field,status,baseValue:noteDraft?.id===q.id?noteDraft.baseValue:latest};noteEditor=editor;field.value=noteDraft?.id===q.id?noteDraft.value:latest;
   const capture=()=>{noteDraft={id:q.id,value:field.value,baseValue:noteDraft?.id===q.id?noteDraft.baseValue:editor.baseValue};};field.oninput=capture;status.setAttribute('role','status');
   note.append(el('h3','','记一句错因'),field,status,btn('保存笔记','quiet-btn',()=>{capture();saveDraft();}));box.append(note);
  }
  const nav=el('div','practice-nav'),prev=btn('上一题','quiet-btn',()=>move(-1)),next=btn(position===queue.length-1?'本轮完成':'下一题','primary-btn',()=>{if(position===queue.length-1){if(flush()){toast('本轮已到最后一题，可更换试卷或重新做。');}}else move(1);});prev.disabled=position===0;nav.append(prev,btn('重新做本题','text-btn',()=>{if(flush()){rounds.delete(q.id);draw();}}),next);box.append(nav);return box;
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
