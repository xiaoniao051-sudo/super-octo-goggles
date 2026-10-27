import {fetchJson} from './network.js?v=20261027-ux';
const REQUIRED_TEXT=['title','paper','date','scoreLabel','summary','questionText','userAnswer','reportText','provenance'];
export function validateReviews(data){
 if(!data||data.schema!==1||!Array.isArray(data.reviews))throw Error('批改记录格式不正确');
 const seen=new Set();
 for(const r of data.reviews){
  if(!r||typeof r!=='object'||!/^[-a-z0-9]{1,100}$/.test(r.id)||seen.has(r.id)||!REQUIRED_TEXT.every(k=>typeof r[k]==='string')||!['graded','historical'].includes(r.status)||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!['string','number'].includes(typeof r.questionNumber)||!Array.isArray(r.sources)||!r.sources.every(s=>s&&typeof s.title==='string'&&typeof s.url==='string')||(r.sections!==undefined&&(!Array.isArray(r.sections)||!r.sections.every(s=>s&&typeof s.heading==='string'&&typeof s.body==='string'))))throw Error('批改记录字段不完整，请重新加载或联系整理者');
  seen.add(r.id);
 }
 return [...data.reviews].sort((a,b)=>b.date.localeCompare(a.date));
}
export function matchingReviews(reviews,query){const words=String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);return reviews.filter(r=>{const text=[r.title,r.paper,r.questionNumber,r.summary,r.scoreLabel,r.questionText,r.userAnswer,r.reportText].join(' ').toLowerCase();return words.every(w=>text.includes(w));});}
export function safeSourceUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function safeReturnUrl(value,base){try{const root=new URL('./',base),u=new URL(value,root);return u.origin===root.origin&&[root.pathname,root.pathname+'index.html'].includes(u.pathname)?u.pathname+u.search+u.hash:null;}catch{return null;}}
export function inlineTokens(text){return String(text).split(/(\*\*[^*]+\*\*|\[[^\]\n]+\]\([^\s)]+\))/g).filter(Boolean).map(value=>{if(value.startsWith('**')&&value.endsWith('**'))return {kind:'strong',text:value.slice(2,-2)};const link=value.match(/^\[([^\]\n]+)\]\(([^\s)]+)\)$/),href=link&&safeSourceUrl(link[2]);return href?{kind:'link',text:link[1],href}:{kind:'text',text:value};});}
export function reportBlocks(text,sections=[]){
 const known=new Set(sections.map(s=>s.heading.trim()));
 const blocks=[],pending=[];
 const flush=()=>{if(pending.length){blocks.push({kind:'paragraph',text:pending.join('\n')});pending.length=0;}};
 for(const line of String(text).replace(/\r\n?/g,'\n').split('\n')){
  const trim=line.trim(),markdown=trim.match(/^(#{1,4})\s+(.+)$/),bold=trim.match(/^\*\*(.+)\*\*$/),plain=bold?bold[1]:trim;
  const numbered=plain.length<=70&&/^(?:[一二三四五六七八九十]+[、．.]|[（(][一二三四五六七八九十\d]+[）)]|\d{1,2}[、．.]\s)/.test(plain);
  if(markdown||((known.has(plain)||numbered)&&plain.length<=100)){flush();blocks.push({kind:'heading',text:markdown?markdown[2]:plain,level:markdown&&markdown[1].length>=3?3:2});}
  else if(!trim)flush();else pending.push(line);
 }
 flush();return blocks;
}
export function plainReview(r){return [r.title,`${r.paper}${r.questionNumber?' · 第 '+r.questionNumber+' 题':''}`,r.date,r.status==='historical'?'历史批改归档（本次未重新评分）':'申论批改',r.scoreLabel,'\n【原题】',r.questionText||'未留存原题文字。','\n【原作答】',r.userAnswer||'未留存原作答文字。','\n【完整批改】',r.reportText||'未留存完整批改文字。','\n【归档说明】',r.provenance,'\n【出处】',...r.sources.filter(s=>safeSourceUrl(s.url)).map(s=>s.title+'\n'+s.url)].filter(Boolean).join('\n');}

function start(){
 const $=selector=>document.querySelector(selector);
 const backUrl=safeReturnUrl(new URLSearchParams(location.search).get('return')||'./#home',location.href)||'./#home';
 const cameFromMain=safeReturnUrl(document.referrer,location.href)!==null&&Boolean(document.referrer)&&history.length>1;
 document.querySelectorAll('[data-back-study]').forEach(a=>{a.href=backUrl;a.onclick=e=>{if(cameFromMain&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey&&e.button===0){e.preventDefault();history.back();}};});
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 let reviews=[],query='',loadState='loading',sequence=0,current=null,tab='report',positions={};
 const textInto=(node,text)=>{for(const token of inlineTokens(text)){if(token.kind==='strong')node.append(el('strong','',token.text));else if(token.kind==='link'){const a=el('a','',token.text);a.href=token.href;a.target='_blank';a.rel='noopener noreferrer';node.append(a);}else node.append(document.createTextNode(token.text));}};
 const makeButton=(text,action)=>{const b=el('button','primary-btn',text);b.type='button';b.onclick=action;return b;};
 const empty=(title,message,action,label)=>{const n=el('section','empty');n.append(el('h2','',title),el('p','',message));if(action)n.append(makeButton(label,action));return n;};
 const meta=r=>[r.paper,r.questionNumber?'第 '+r.questionNumber+' 题':''].filter(Boolean).join(' · ');
 function badges(r){const nodes=[el('span','badge'+(r.status==='historical'?' historical':''),r.status==='historical'?'历史批改':'本次批改')];if(r.scoreLabel)nodes.push(el('span','badge score',r.scoreLabel));return nodes;}
 function listState(){return {kind:'list',query,y:window.scrollY};}
 function rememberList(){history.replaceState({essayBoard:listState()},'',location.href);}
 function renderList(){
  $('#essay-clear').hidden=!query;$('#essay-search').value=query;const list=$('#review-list');list.replaceChildren();const status=$('#archive-status');status.replaceChildren();
  if(loadState==='loading'){$('#essay-count').textContent='正在加载批改记录…';return;}
  if(loadState==='error'){$('#essay-count').textContent='暂未加载';status.append(empty('批改记录暂时没加载出来','可以重新加载；这不会修改已有的学习笔记。',load,'重新加载'));return;}
  const matches=matchingReviews(reviews,query);$('#essay-count').textContent=matches.length+' 篇 / 共 '+reviews.length+' 篇';
  if(!matches.length){list.append(empty(reviews.length?'没有找到相关批改':'还没有收录批改',reviews.length?'换个关键词，或清除搜索查看全部文章。':'整理好的原作答与批改会显示在这里。',reviews.length?resetSearch:null,'清除搜索'));return;}
  for(const r of matches){const card=el('button','review-card');card.type='button';card.dataset.reviewId=r.id;const badgeBox=el('div','badges');badgeBox.append(...badges(r));const foot=el('div','card-foot');foot.append(el('span','',r.date),el('span','open-label','查看完整批改 →'));card.append(badgeBox,el('h2','',r.title),el('p','',meta(r)));if(r.summary)card.append(el('p','card-summary',r.summary));card.append(foot);card.onclick=()=>openReview(r.id);list.append(card);}
 }
 function resetSearch(){query='';renderList();rememberList();$('#essay-search').focus();}
 function openReview(id){rememberList();history.pushState({essayBoard:{kind:'review',id,query,listY:window.scrollY,fromList:true,tab:'report'}},'','#review='+encodeURIComponent(id));positions={};route();}
 function backToList(){if(history.state?.essayBoard?.fromList)history.back();else{history.replaceState({essayBoard:{kind:'list',query,y:0}},'',location.pathname+location.search);route();}}
 function renderText(text,kind){
  const content=$('#review-content');content.replaceChildren();
  if(!text.trim()){content.append(el('p','missing-text',kind==='answer'?'这次历史记录未留存完整原作答，不能据此还原原文。':kind==='question'?'这次历史记录未留存完整题干；请结合下方出处核对试卷，不根据标题补写原题。':'尚未留存完整批改正文。'));return;}
  if(kind!=='report'){content.append(el('p','original-text',text));return;}
  const blocks=reportBlocks(text,current.sections||[]),headings=blocks.filter(b=>b.kind==='heading');
  let tocLinks;if(headings.length){const toc=el('details','report-toc');toc.append(el('summary','','批改目录 · '+headings.length+' 个部分'));tocLinks=el('nav','toc-links');tocLinks.setAttribute('aria-label','批改目录');toc.append(tocLinks);content.append(toc);}
  let n=0;
  for(const block of blocks){const node=el(block.kind==='heading'?'h'+block.level:'p','report-block');textInto(node,block.text);if(block.kind==='heading'){node.id='section-'+current.id+'-'+(++n);const link=el('a','',block.text.replaceAll('**',''));link.href='#'+node.id;link.onclick=e=>{e.preventDefault();node.scrollIntoView({behavior:'auto',block:'start'});};tocLinks.append(link);}content.append(node);}
 }
 function renderContent(){
  document.querySelectorAll('[data-review-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.reviewTab===tab)));
  renderText(tab==='answer'?current.userAnswer:tab==='question'?current.questionText:current.reportText,tab);
  const content=$('#review-content');
  if(tab==='question'){
   content.append(el('h2','','原题与核对出处'));const sources=current.sources.filter(s=>safeSourceUrl(s.url));
   if(sources.length){const list=el('ul','source-list');for(const s of sources){const li=el('li'),link=el('a','',s.title+' ↗');link.href=safeSourceUrl(s.url);link.target='_blank';link.rel='noopener noreferrer';li.append(link);list.append(li);}content.append(list);}else content.append(el('p','muted','未留存可直接打开的公开来源链接。'));
  }
  if(current.provenance)content.append(el('p','provenance',current.provenance));
 }
 function selectTab(name){positions[tab]=window.scrollY;tab=name;history.replaceState({essayBoard:{...history.state?.essayBoard,tab}},'',location.href);renderContent();window.scrollTo({top:positions[tab]||0,left:0,behavior:'instant'});}
 function route(){
  const id=new URLSearchParams(location.hash.slice(1)).get('review'),saved=history.state?.essayBoard;
  if(saved&&typeof saved.query==='string')query=saved.query;
  if(id){
   $('#archive-view').hidden=true;$('#reader-view').hidden=false;current=reviews.find(r=>r.id===id);$('#action-status').hidden=true;
   if(!current){$('#review-title').textContent=loadState==='loading'?'正在加载批改…':'没有找到这篇批改';$('#review-paper').textContent='';$('#reader-badges').replaceChildren();$('#review-notice').hidden=true;$('#download-review').disabled=true;$('.reader-tabs').hidden=true;$('#review-content').replaceChildren(empty(loadState==='loading'?'请稍等':loadState==='error'?'批改暂时无法加载':'这篇记录暂未收录',loadState==='loading'?'正在读取已归档记录。':'可以返回列表重新查找，或重新加载。',loadState==='loading'?null:load,'重新加载'));return;}
   document.title=current.title+' · 申论批改';$('#download-review').disabled=false;$('.reader-tabs').hidden=false;$('#review-title').textContent=current.title;$('#review-paper').textContent=meta(current)+' · '+current.date;$('#reader-label').textContent='申论批改';$('#reader-badges').replaceChildren(...badges(current));
   const notice=$('#review-notice');notice.hidden=false;notice.className='notice'+(current.status==='historical'?' historical':'');notice.textContent=current.status==='historical'?'历史批改归档：保留当时的评语和分数，本次没有重新评分。':'建议分用于复盘学习，不等同于官方阅卷分；完整评点、修改方法和定档依据见正文。';
   tab=['report','answer','question'].includes(saved?.tab)?saved.tab:'report';renderContent();window.scrollTo({top:0,left:0,behavior:'instant'});
  }else{
   current=null;document.title='申论批改 · 国考精选';$('#reader-view').hidden=true;$('#archive-view').hidden=false;renderList();requestAnimationFrame(()=>window.scrollTo({top:saved?.kind==='list'?saved.y||0:0,left:0,behavior:'instant'}));
  }
 }
 async function load(){const request=++sequence;loadState='loading';route();$('#essay-refresh').disabled=true;try{const data=validateReviews(await fetchJson('./essay-reviews.json',{label:'申论批改'}));if(request!==sequence)return;reviews=data;loadState='ready';}catch{if(request!==sequence)return;loadState='error';}finally{if(request===sequence){$('#essay-refresh').disabled=false;route();}}}
 $('#essay-search').oninput=e=>{query=e.target.value;renderList();rememberList();};$('#essay-clear').onclick=resetSearch;$('#essay-refresh').onclick=load;$('#back-reviews').onclick=backToList;
 document.querySelectorAll('[data-review-tab]').forEach(b=>b.onclick=()=>selectTab(b.dataset.reviewTab));
 $('#download-review').onclick=()=>{if(!current)return;const blob=new Blob([plainReview(current)],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=current.title.replace(/[\\/:*?"<>|]/g,'_')+'-申论批改.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);$('#action-status').hidden=false;$('#action-status').textContent='已生成文字版；请在浏览器下载或共享菜单中保存。';};
 history.scrollRestoration='manual';addEventListener('popstate',route);addEventListener('hashchange',route);load();
}
function connectEntries(){
 document.querySelectorAll('[data-essay-entry]').forEach(a=>a.addEventListener('click',e=>{
  const target=new URL('./essay-reviews.html',location.href);target.searchParams.set('return',location.pathname+location.search+location.hash);a.href=target.href;
  if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey&&e.button===0)history.replaceState({...history.state,scrollY:window.scrollY},'',location.href);
 }));
}
if(typeof document!=='undefined'){if(document.querySelector('#archive-view'))start();else connectEntries();}
