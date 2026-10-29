import {searchExcerpt,orderCards} from './study-ui.js?v=20261022-ux';
import {loadStudy,saveCard,saveScratchpad,mergeStudy} from './storage.js?v=20261020-review2';
import {createQuestionBoard} from './questions.js?v=20261027-ux';
import {fetchJson} from './network.js?v=20261027-ux';
const $=s=>document.querySelector(s);
const categories=['词语辨析','申论','政治理论','法律常识','科技常识','资料分析','判断推理','言语理解','数量关系'];
const browseCategories=['预测','词语辨析','申论','政治理论','常识','资料分析','判断推理','言语理解','数量关系'];
const essayThemes=['执法背诵','人物案例','背景句','名言','答题方法','全部拓展','经济建设','政治建设','文化建设','社会建设','生态文明建设'];
const recitationLabels={person:'人物案例',background:'背景句',quote:'名言'};
const themeLabels={'执法背诵':'先背这些','全部拓展':'全部素材','经济建设':'经济','政治建设':'政治','文化建设':'文化','社会建设':'社会','生态文明建设':'生态'};
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const icon=name=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg'),u=document.createElementNS('http://www.w3.org/2000/svg','use');u.setAttribute('href','#i-'+name);s.setAttribute('aria-hidden','true');s.append(u);return s;};
let questionBoard,library,study,selected,category='全部精选',essayTheme='执法背诵',screen='home',review='starred',lastRead='',returnScreen='home',returnY=0,returnPanel=null,readerIds=[],toastTimer,uiState={};
let readerTab='overview',readerOrigin=null,returnFocusFrame;
let modalOrigin=null,modalClosing=false,modalSequence=0,routePending=false;
const pending=new Map(),activeSaves=new Set(),latestTasks=new Map(),toggleVersions=new Map();
const UI_KEY='guokao-2027-ui-v1';
try{const saved=JSON.parse(localStorage.getItem(UI_KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))uiState=saved;lastRead=uiState.lastRead||'';}catch{}
function saveUI(patch){uiState={...uiState,...patch};try{localStorage.setItem(UI_KEY,JSON.stringify(uiState));}catch{}}
const toast=text=>{clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);};
function tracked(p){activeSaves.add(p);p.then(()=>activeSaves.delete(p),()=>activeSaves.delete(p));return p;}
function getCardState(id){return study.cards[id]||{note:'',starred:false,mastered:false};}
const flat=c=>[c.title,c.category,c.theme,...(c.terms||[]),c.summary,c.why,...c.tags,...c.sections.map(s=>s.heading+' '+s.body),c.example.question,c.example.answer,c.example.explanation,...c.pitfalls,getCardState(c.id).note].join(' ').toLowerCase();
async function api(url,data){
 if(url==='/api/library')return fetchJson('./library.json',{label:'知识库'});
 if(url==='/api/state')return loadStudy(localStorage);
 const ids=library.cards.map(c=>c.id);
 if(url==='/api/card'){const state=saveCard(localStorage,data.id,data,ids);return {saved:true,card:state.cards[data.id]};}
 if(url==='/api/scratchpad'){saveScratchpad(localStorage,data.text);return {saved:true};}
 if(url==='/api/import')return mergeStudy(localStorage,data,ids);
 throw Error('未知操作');
}
function inCategory(c,cat=category){if(cat==='预测')return c.collection==='prediction';return cat==='全部精选'||c.category===cat||(cat==='常识'&&['法律常识','科技常识'].includes(c.category));}
function inTheme(c){if(category!=='申论')return true;if(essayTheme==='执法背诵')return c.kind==='recitation';if(['人物案例','背景句','名言'].includes(essayTheme))return c.kind==='recitation'&&recitationLabels[c.recitationType]===essayTheme;if(essayTheme==='答题方法')return !c.theme&&c.kind!=='recitation';if(essayTheme==='全部拓展')return c.kind==='material';return c.theme===essayTheme;}
function matching(){const words=$('#search').value.toLowerCase().trim().split(/\s+/).filter(Boolean),filter=$('#filter').value;return orderCards(library.cards.filter(c=>{const s=getCardState(c.id);return inCategory(c)&&inTheme(c)&&(filter!=='mastered'||s.mastered)&&(filter!=='unlearned'||!s.mastered)&&(filter!=='noted'||s.note?.trim())&&(filter!=='starred'||s.starred)&&words.every(w=>flat(c).includes(w));}),$('#library-sort').value);}
function reviewItems(){return library.cards.filter(c=>{const s=getCardState(c.id);return review==='starred'?s.starred:review==='noted'?s.note?.trim():!s.mastered;});}
function showScreen(name){screen=name;document.body.classList.toggle('reading',name==='reading');document.querySelectorAll('.screen').forEach(s=>s.hidden=s.id!==name+'-screen');document.querySelectorAll('[data-screen]').forEach(b=>{b.classList.toggle('active',b.dataset.screen===name);if(b.dataset.screen===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});}
function panelState(name=screen,y=window.scrollY){return {screen:name,category,essayTheme,query:$('#search').value,filter:$('#filter').value,review,scrollY:y};}
function rememberPanel(){if(screen!=='reading'){const state=panelState();history.replaceState({...history.state,...state},'',location.href);saveUI({panel:state});}}
function restorePanel(state){if(!state)return;category=['全部精选','常识','预测',...categories].includes(state.category)?state.category:'全部精选';essayTheme=essayThemes.includes(state.essayTheme)?state.essayTheme:'执法背诵';if(category==='申论'&&!uiState.essayFocusV9){essayTheme='执法背诵';state={...state,essayTheme,query:'',filter:'all',scrollY:0};saveUI({essayFocusV9:true,panel:state});if(history.state?.reading){returnPanel=state;returnY=0;}const entry=history.state?.reading?{...history.state,returnPanel:state,returnY:0}:{...history.state,...state};history.replaceState(entry,'',location.href);}$('#search').value=typeof state.query==='string'?state.query:'';$('#filter').value=['all','unlearned','mastered','noted','starred'].includes(state.filter)?state.filter:'all';review=['starred','noted','unlearned'].includes(state.review)?state.review:'starred';}
function rememberReading(id){lastRead=id;saveUI({lastRead:id});}
function navigate(name,{replace=false,scroll=true}={}){if(!['home','library','review','qa','me'].includes(name))name='home';const same=name===screen;rememberPanel();history[replace||same?'replaceState':'pushState'](panelState(name,scroll?0:window.scrollY),'','#'+(name==='library'&&category==='预测'?'prediction':name));showScreen(name);renderPanels();if(scroll)window.scrollTo({top:0,left:0,behavior:'instant'});}
function defaultReaderIds(c){if(c.collection==='prediction')return library.cards.filter(x=>x.collection==='prediction').map(x=>x.id);return library.cards.filter(x=>x.category===c.category&&(c.kind==='recitation'?x.kind==='recitation'&&x.recitationType===c.recitationType:(!c.theme||x.theme===c.theme))).map(x=>x.id);}
function openCard(id,{replace=false}={}){const c=library.cards.find(c=>c.id===id);if(!c)return;
 const fromPanel=screen!=='reading',canGoBack=fromPanel?!replace:history.state?.canGoBack===true;
 if(fromPanel){readerOrigin=document.activeElement;rememberPanel();returnScreen=screen;returnY=window.scrollY;returnPanel=panelState();readerIds=screen==='library'?matching().map(x=>x.id):screen==='review'?reviewItems().map(x=>x.id):defaultReaderIds(c);}
 selected=id;rememberReading(id);
 history[replace?'replaceState':'pushState']({reading:true,canGoBack,returnScreen,returnY,returnPanel,readerIds},'','#card='+encodeURIComponent(id));showScreen('reading');reader(c);window.scrollTo({top:0,left:0,behavior:'instant'});$('#reader').focus({preventScroll:true});
}
function syncRoute(){if(!library)return;const id=location.hash.match(/^#card=([a-z0-9-]+)$/)?.[1],c=library.cards.find(c=>c.id===id);if(c){selected=c.id;rememberReading(c.id);returnScreen=['home','library','review','qa','me'].includes(history.state?.returnScreen)?history.state.returnScreen:'home';returnY=history.state?.returnY||0;returnPanel=history.state?.returnPanel||uiState.panel||null;restorePanel(returnPanel);const savedIds=history.state?.readerIds;readerIds=Array.isArray(savedIds)&&savedIds.includes(c.id)?savedIds.filter(id=>library.cards.some(x=>x.id===id)):defaultReaderIds(c);showScreen('reading');reader(c);window.scrollTo({top:0,left:0,behavior:'instant'});}else{const name=location.hash.slice(1),target=name==='prediction'?'library':['home','library','review','qa','me'].includes(name)?name:'home',state=history.state?.screen===target?history.state:uiState.panel?.screen===target?uiState.panel:null;restorePanel(state||uiState.panel);if(name==='prediction'){category='预测';if(state?.category!=='预测'){$('#search').value='';$('#filter').value='all';}}showScreen(target);renderPanels();const y=state?.scrollY||0;requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'instant'}));}}
async function backFromReader(){try{await flush();if(history.state?.canGoBack===true)history.back();else navigate(returnScreen,{replace:true});}catch(e){toast(e.message);}}
function counts(){const states=library.cards.map(c=>getCardState(c.id));return {done:states.filter(s=>s.mastered).length,starred:states.filter(s=>s.starred).length,noted:states.filter(s=>s.note?.trim()).length};}
function nav(){const target=$('#navigation');target.replaceChildren();for(const cat of ['全部精选',...browseCategories]){const active=cat===category||(cat==='常识'&&['法律常识','科技常识'].includes(category)),b=el('button','side-btn'+(active?' active':''),cat);b.setAttribute('aria-pressed',String(active));b.onclick=()=>{category=cat;essayTheme='执法背诵';rememberPanel();history.replaceState(panelState(),'','#'+(cat==='预测'?'prediction':'library'));renderPanels();};target.append(b);}renderThemes();
 const n=counts();$('#home-favorites').textContent='收藏 '+n.starred;$('#fav-count').textContent=n.starred;$('#note-count').textContent=n.noted;$('#todo-count').textContent=library.cards.length-n.done;
 $('#me-done').textContent=n.done;$('#me-starred').textContent=n.starred;$('#me-notes').textContent=n.noted;
 document.querySelectorAll('[data-review]').forEach(b=>{b.classList.toggle('active',b.dataset.review===review);b.setAttribute('aria-pressed',String(b.dataset.review===review));});
}
function renderThemes(){
 $('#prediction-note').hidden=category!=='预测';
 const box=$('#essay-themes');box.hidden=category!=='申论';const tabs=$('#theme-navigation');tabs.replaceChildren();
 const add=(target,theme)=>{const b=el('button','theme-btn'+(theme===essayTheme?' active':''),themeLabels[theme]||theme);b.setAttribute('aria-pressed',String(theme===essayTheme));b.onclick=()=>{essayTheme=theme;saveUI({essayFocusV9:true});rememberPanel();renderThemes();list(matching());};target.append(b);};
 essayThemes.slice(0,5).forEach(t=>add(tabs,t));
 const more=el('details','essay-more');more.open=essayThemes.slice(5).includes(essayTheme);more.append(el('summary','','拓展素材 · 五位一体'));const extra=el('div','theme-navigation');essayThemes.slice(5).forEach(t=>add(extra,t));more.append(extra);tabs.append(more);
 const descriptions={'执法背诵':'先选熟悉且贴合题意的案例，再选一句背景句或名言。写清具体行动，以及它如何支持本段观点。','人物案例':'杨雪峰、田如良中先选熟悉的一例：记准身份和行动，再按题目换一句分析。','背景句':'用于开头、段落引入或简短对策。每次选一句，再接材料中的具体对象和问题。','名言':'记短句，也记准出处。引完要解释与本题的关系。','答题方法':'小题与应用文先依据给定资料组织答案；大作文可参考限时安排，用普通语言写清观点与依据。','全部拓展':'原有五位一体案例，按需要查阅，不列入优先背诵清单。'};
 $('#theme-description').textContent=descriptions[essayTheme]||'拓展阅读：'+essayTheme+'。需要时查阅，优先背诵仍从人物、背景句和名言开始。';
}
function cardButton(c,{compact=false,showNote=false,query=''}={}){const s=getCardState(c.id),b=el('button','knowledge-card'+(compact?' compact':''));b.setAttribute('aria-label',c.title);b.dataset.cardId=c.id;
 const meta=el('div','card-meta');meta.append(el('span','',(c.collection==='prediction'?'预测 · ':'')+c.category+(c.theme?' · '+c.theme:'')),el('span','priority-label',c.kind==='recitation'?(recitationLabels[c.recitationType]+' · 直接背'):c.kind==='material'?'拓展素材':c.kind==='vocabulary'?'对比记忆':c.collection==='prediction'?'备考建议':c.priority===1?'核心必会':'进阶补充'));
 const stateLine=el('div','card-state');stateLine.append(el('span',s.mastered?'learned':'',s.mastered?'✓ 已掌握':'○ 待掌握'));if(s.starred)stateLine.append(el('span','','★ 收藏'));if(s.note?.trim())stateLine.append(el('span','','有笔记'));
 b.append(meta,el('h3','',c.title),el('p','',showNote&&s.note?.trim()?'我的笔记：'+s.note:searchExcerpt(c,query,s.note)),stateLine);b.onclick=()=>openCard(c.id);return b;
}
function empty(target,title,text,action,label){const box=el('div','empty');box.append(icon('book'),el('h3','',title),el('p','',text));if(action){const b=el('button','quiet-btn',label);b.onclick=action;box.append(b);}target.append(box);}
function resetLibrary(){$('#search').value='';$('#filter').value='all';category='全部精选';essayTheme='执法背诵';rememberPanel();history.replaceState(panelState(),'','#library');renderPanels();}
function searchEverywhere(){category='全部精选';essayTheme='执法背诵';$('#filter').value='all';rememberPanel();history.replaceState(panelState(),'','#library');renderPanels();}
function list(items){const target=$('#cards'),query=$('#search').value.trim(),restricted=category!=='全部精选'||$('#filter').value!=='all';target.replaceChildren();$('#library-reset').hidden=!query&&!restricted;$('#category-title').textContent=category+(category==='申论'?' · '+(themeLabels[essayTheme]||essayTheme):'');$('#result-count').textContent=items.length+' 张积累卡';$('#search-scope').hidden=!query;$('#search-scope-text').textContent='搜索“'+query+'” · '+(restricted?'当前范围：'+category+(category==='申论'?' / '+(themeLabels[essayTheme]||essayTheme):'')+' / '+$('#filter').selectedOptions[0].textContent:'全部知识');$('#search-everywhere').hidden=!restricted;
 if(!items.length)empty(target,'这里暂时没有匹配内容',query&&restricted?'保留关键词，到全部知识里再找一次。':'试试缩短关键词，例如“田如良”或“增长率”。',query&&restricted?searchEverywhere:resetLibrary,query&&restricted?'在全部知识中搜索':'清除筛选');else items.forEach(c=>target.append(cardButton(c,{query})));
}
function renderReview(){const target=$('#review-list');target.replaceChildren();const items=reviewItems();
 $('#review-description').textContent=review==='starred'?'主动收藏的重点，值得再看一遍。':review==='noted'?'带着自己写下的理解和错因复习。':'尚未标记为已掌握，按优先级逐个学。';
 if(!items.length)empty(target,review==='starred'?'还没有收藏':review==='noted'?'还没有知识点笔记':'所有卡片都已掌握',review==='unlearned'?'可以回看收藏，或用例题检查是否还记得。':'阅读时随手标记重点，这里会帮你收好。',()=>navigate('library'),'去知识库看看');
 else items.forEach(c=>target.append(cardButton(c,{showNote:review==='noted'})));
}
function renderHome(){
 $('#home-search').onclick=()=>{category='全部精选';essayTheme='执法背诵';$('#search').value='';$('#filter').value='all';navigate('library');$('#search').focus();};
 $('#home-favorites').onclick=()=>{review='starred';navigate('review');};
 $('#home-essay').onclick=()=>{category='申论';essayTheme='执法背诵';$('#search').value='';$('#filter').value='all';navigate('library');};
}
function renderPanels(){nav();if(screen==='home')renderHome();if(screen==='library')list(matching());if(screen==='review')renderReview();questionBoard?.render();}
function status(id,text,error=false){const node=id==='scratchpad'?$('#scratch-status'):$('#reader').dataset.card===id?$('#note-status'):null;if(node){node.textContent=text;node.classList.toggle('error',error);}}
function saveTask(key,task){return tracked(performSave(key,task));}
async function performSave(key,task){pending.delete(key);try{await api(task.url,task.data);if(latestTasks.get(key)===task)status(key,'已保存到此设备');nav();}catch(e){status(key,'保存失败，请重试',true);toast('笔记尚未保存：'+e.message);if(latestTasks.get(key)===task&&!pending.has(key))pending.set(key,task);}}
function schedule(key,url,data){status(key,'保存中…');const task={url,data};latestTasks.set(key,task);pending.set(key,task);saveTask(key,task);}
async function flush(){questionBoard?.flush();for(const[key,task]of[...pending])await saveTask(key,task);await Promise.all([...activeSaves]);if(pending.size)throw Error('仍有未保存的笔记，请稍后重试');}
function refreshReaderActions(id){if($('#reader').dataset.card!==id)return;const s=getCardState(id);for(const[field,labelOn,labelOff]of[['starred','★ 已收藏','☆ 收藏'],['mastered','✓ 已掌握','标为已掌握']]){for(const b of [$('#reader [data-action="'+field+'"]'),...(field==='mastered'?[$('#reader-mastered')]:[])]){if(b){b.textContent=s[field]?labelOn:labelOff;b.classList.toggle('on',s[field]);b.setAttribute('aria-pressed',String(s[field]));}}}}
function toggle(id,field){return tracked(performToggle(id,field));}
async function performToggle(id,field){const key=id+':'+field,version=(toggleVersions.get(key)||0)+1;toggleVersions.set(key,version);const old=getCardState(id)[field],value=!old;study.cards[id]={...getCardState(id),[field]:value};refreshReaderActions(id);nav();try{await api('/api/card',{id,[field]:value});}catch(e){if(toggleVersions.get(key)===version){study.cards[id]={...getCardState(id),[field]:old};refreshReaderActions(id);nav();}toast('状态未保存：'+e.message);}}
function applyReaderFont(){document.body.classList.toggle('large-reading',uiState.largeText===true);$('#reader-font').setAttribute('aria-pressed',String(uiState.largeText===true));$('#reader-font').textContent=uiState.largeText?'标准字':'大字';}
function setReaderTab(name){readerTab=$('#reader').dataset.category!=='申论'&&['overview','practice','notes'].includes(name)?name:'overview';$('#reader').querySelectorAll('[data-reader-pane]').forEach(p=>p.hidden=p.dataset.readerPane!==readerTab);document.querySelectorAll('[data-reader-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.readerTab===readerTab)));window.scrollTo({top:0,left:0,behavior:'instant'});if(readerTab==='notes')$('#card-note')?.focus({preventScroll:true});}
function reader(c){const r=$('#reader'),essayOnly=c.category==='申论';r.replaceChildren();r.dataset.card=c.id;r.dataset.category=c.category;$('.reader-tabs').hidden=essayOnly;const s=getCardState(c.id),heading=el('div','reader-heading'),actions=el('div','reader-actions');
 for(const field of ['starred','mastered']){const b=el('button','icon-btn');b.dataset.action=field;b.onclick=()=>toggle(c.id,field);actions.append(b);}
 heading.append(el('span','reader-meta',[c.category,c.theme].filter(Boolean).join(' · ')),actions);r.append(heading,el('h2','',c.title));
 const overview=el('section','reader-pane'),practice=el('section','reader-pane'),notes=el('section','reader-pane');
 for(const [node,name,label]of[[overview,'overview','知识要点'],[practice,'practice','练习与示范'],[notes,'notes','我的笔记']]){node.dataset.readerPane=name;node.setAttribute('aria-label',label);}
 if(c.collection==='prediction')overview.append(el('p','prediction-reader-note','预测 · 备考方向与写作建议，非官方命题范围。法规事实已另核对，原创句式与练习供结合题目改写。'));
 if(c.terms?.length){const terms=el('div','vocabulary-terms');terms.setAttribute('aria-label','本组词语');c.terms.forEach(term=>terms.append(el('span','',term)));overview.append(terms);}
 const core=el('section','summary-block');core.append(el('span','recite-label',c.recite?(c.recitationType==='person'?'先背这一段':c.recitationType==='quote'?'原文 · 核对出处':'背诵版 · 原创表达'):'先记住这一点'));
 const summary=el('p','summary',c.recite||c.summary),placeholder=el('p','recall-placeholder','试着用自己的话回忆，再展开核对。');placeholder.hidden=true;core.append(summary,placeholder);
 const recallActions=el('div','recall-actions'),recall=el('button','text-btn','遮住，试着回忆');recall.setAttribute('aria-pressed','false');recall.onclick=()=>{summary.hidden=!summary.hidden;placeholder.hidden=!summary.hidden;recall.textContent=summary.hidden?'显示要点':'遮住，试着回忆';recall.setAttribute('aria-pressed',String(summary.hidden));};recallActions.append(recall);
 if(c.recite){const copy=el('button','text-btn','复制背诵段');copy.onclick=async()=>{try{await navigator.clipboard.writeText(c.recite);toast('已复制背诵段');}catch{toast('此浏览器未允许复制，请长按背诵文字选择复制。');}};recallActions.append(copy);}core.append(recallActions);overview.append(core);
 if(c.why&&!c.recite)overview.append(el('p','why','为什么要学：'+c.why));
 const sections=c.sections.filter(x=>!c.recite||!x.heading.startsWith('直接背'));
 sections.forEach((section,index)=>{const block=el('details','reader-section');block.open=sections.length<=4||index===0;block.append(el('summary','',section.heading),el('div','text',section.body));overview.append(block);});
 const hints=el('section','reader-hints');hints.append(el('h3','',c.kind==='recitation'?'使用提醒':c.kind==='material'?'迁移使用时注意':'容易错在哪里'));const ul=el('ul');c.pitfalls.forEach(t=>ul.append(el('li','',t)));hints.append(ul);overview.append(hints);
 const refs=el('details','reader-sources');refs.append(el('summary','','来源与核对依据'));const sources=el('div','source-list');for(const source of c.sources){if(!/^https?:\/\//.test(source.url))continue;const a=el('a','',(source.role||'来源')+' · '+source.title+' ↗');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';sources.append(a);}refs.append(sources,el('p','reader-meta',[c.origin,'核对日期 '+c.reviewedAt].filter(Boolean).join(' · ')));overview.append(refs);
 if(!essayOnly){
 const toPractice=el('button','primary-btn reader-practice-entry',c.kind==='recitation'?'看看怎样用到题目里':'做一道小练习');toPractice.onclick=()=>setReaderTab('practice');overview.append(toPractice);
 practice.append(el('h3','reader-pane-heading',c.kind==='recitation'?'用到题目里':'先试一试，再看答案'));
 const example=el('section','example');example.append(el('span','label',c.kind==='recitation'?'原创使用示范':c.kind==='material'?'自编改写练习':c.kind==='vocabulary'?'自编辨析练习':'自编小例题'),el('p','',c.example.question));const details=el('details');details.append(el('summary','',c.kind==='recitation'?'展开回扣示范':c.kind==='material'?'查看参考写法与解释':'查看答案与解释'),el('p','',c.example.answer),el('p','',c.example.explanation));example.append(details);practice.append(example);
 const write=el('button','quiet-btn','记下我的理解或错因');write.onclick=()=>setReaderTab('notes');practice.append(write);
 const nh=el('div','note-heading');nh.append(el('h3','reader-pane-heading','我的笔记'));const saved=el('span','save-status',pending.has(c.id)?'尚有未保存内容':'输入后自动保存到此设备');saved.id='note-status';saved.setAttribute('role','status');saved.setAttribute('aria-live','polite');nh.append(saved);
 const box=el('textarea','note-box');box.id='card-note';box.setAttribute('aria-label','我的知识点笔记');box.placeholder=c.kind==='material'?'写一句自己的改写，记下能用这个素材的题目…':c.kind==='vocabulary'?'用自己的话写出区别，再造一个句子…':'用自己的话复述要点，记下错因或疑问…';box.value=s.note||'';box.oninput=()=>{study.cards[c.id]={...getCardState(c.id),note:box.value};schedule(c.id,'/api/card',{id:c.id,note:box.value});};const retry=el('button','text-btn','立即保存');retry.onclick=()=>{schedule(c.id,'/api/card',{id:c.id,note:box.value});flush().catch(e=>toast(e.message));};notes.append(nh,box,retry,el('p','privacy-note','只保存在当前浏览器。定期在“我的 → 备份笔记”保存一份，换设备或清理微信前先备份。'));
 }
 r.append(overview);if(!essayOnly)r.append(practice,notes);setReaderTab('overview');applyReaderFont();
 refreshReaderActions(c.id);if(!readerIds.includes(c.id))readerIds=defaultReaderIds(c);const index=readerIds.indexOf(c.id);$('#reader-progress').textContent=(category==='预测'?'预测':c.category)+' · '+(index+1)+' / '+readerIds.length;
 const next=library.cards.find(x=>x.id===readerIds[index+1]),previous=library.cards.find(x=>x.id===readerIds[index-1]);
 const move=async card=>{try{await flush();if(card)openCard(card.id,{replace:true});else await backFromReader();}catch(e){toast(e.message);}};
 $('#next-card').textContent=next?'下一张 ›':'返回列表';$('#next-card').title=next?'下一张：'+next.title:'这一组已读完，返回列表';$('#next-card').onclick=()=>move(next);
 $('#previous-card').disabled=!previous;$('#previous-card').onclick=()=>move(previous);$('#reader-mastered').onclick=()=>toggle(c.id,'mastered');
}
function modalFeedback(message){const box=$('#modal-feedback');box.hidden=false;box.replaceChildren(el('p','save-status error',message));const backup=el('button','text-btn','先备份当前记录');backup.onclick=exportNotes;box.append(backup);}
function openModal(title,{reader=false,tools,footer}={}){
 const dialog=$('#modal');
 if(!dialog.open){
  rememberPanel();modalOrigin={y:window.scrollY,focus:document.activeElement,answerId:document.activeElement?.dataset?.answerId,url:location.href,token:++modalSequence};
  history.pushState({...history.state,studyModal:modalOrigin.token},'',location.href);
 }
 $('#modal-title').textContent=title;$('#close-modal').textContent=reader?'‹ 返回列表':'关闭 ×';$('#close-modal').setAttribute('aria-label',reader?'返回错题列表':'关闭弹窗');
 dialog.classList.toggle('question-reader',reader);document.body.classList.add('modal-open');
 $('#modal-content').replaceChildren();$('#modal-tools').replaceChildren(...(tools?[tools]:[]));$('#modal-tools').hidden=!tools;
 $('#modal-footer').replaceChildren(...(footer?[footer]:[]));$('#modal-footer').hidden=!footer;
 $('#modal-feedback').replaceChildren();$('#modal-feedback').hidden=true;
 if(!dialog.open)dialog.showModal();
 $('#modal-content').scrollTop=0;$('#close-modal').focus({preventScroll:true});
 return $('#modal-content');
}
function finishModalClose(){
 const origin=modalOrigin;modalOrigin=null;modalClosing=false;$('#modal').close();document.body.classList.remove('modal-open');questionBoard?.render();
 requestAnimationFrame(()=>{const target=origin?.answerId?$('#qa-list [data-answer-id="'+origin.answerId+'"]'):origin?.focus?.isConnected?origin.focus:null;target?.focus({preventScroll:true});window.scrollTo({top:origin?.y??window.scrollY,left:0,behavior:'instant'});});
}
async function closeModal(){
 if(modalClosing)return;modalClosing=true;
 try{await flush();if(modalOrigin&&history.state?.studyModal===modalOrigin.token)history.back();else finishModalClose();}
 catch(e){modalClosing=false;modalFeedback(e.message);}
}
async function routeChanged(){
 if(routePending)return;routePending=true;
 try{
 if($('#modal').open&&modalOrigin&&history.state?.studyModal!==modalOrigin.token){
  try{await flush();finishModalClose();}
  catch(e){modalClosing=false;history.pushState({...history.state,studyModal:modalOrigin.token},'',modalOrigin.url);modalFeedback(e.message);return;}
 }else if($('#modal').open)return;
 // A forward navigation or a reload must not leave a stale modal-only history entry.
 if(history.state?.studyModal){const {studyModal,...rest}=history.state;history.replaceState(rest,'',location.href);}
 syncRoute();if(screen!=='reading'&&readerOrigin){cancelAnimationFrame(returnFocusFrame);returnFocusFrame=requestAnimationFrame(()=>{if(!readerOrigin||screen==='reading')return;const target=readerOrigin.dataset?.cardId?document.querySelector('#'+screen+'-screen [data-card-id="'+readerOrigin.dataset.cardId+'"]'):readerOrigin.isConnected?readerOrigin:null;target?.focus({preventScroll:true});readerOrigin=null;});}
 }finally{routePending=false;}
}
function sourceModal(){const content=openModal('资料怎样进入这个库');content.append(el('p','modal-caption','先按考试范围筛选，再核对规则与适用条件。数学和逻辑例题重新演算；政策法律使用官方文本。资料多不等于值得背，未经核实的万能口诀不收录。'));for(const audit of library.sourceAudit){const card=el('section','modal-card');card.append(el('h3','',audit.title+' · '+audit.verdict),el('p','',audit.reason));const ul=el('ul');audit.limitations.forEach(s=>ul.append(el('li','',s)));card.append(ul);const a=el('a','','打开资料来源 ↗');a.href=audit.url;a.target='_blank';a.rel='noopener noreferrer';card.append(a,el('p','','许可说明：'+audit.license));content.append(card);}const official=el('section','modal-card');official.append(el('h3','','官方范围与考试年度'),el('p','',library.exam.note||'2027是考试年度，公共科目笔试在2026年举行。'));for(const source of library.exam.sources||[]){const a=el('a','',source.title+' ↗');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';const p=el('p');p.append(a);official.append(p);}content.append(official);}
function scratchModal(){const target=openModal('随手记');target.append(el('p','modal-caption','记下整体复习计划或跨知识点的疑问。只保存在当前设备，请定期备份。'));const area=el('textarea','note-box');area.id='scratchpad';area.setAttribute('aria-label','随手笔记');area.value=study.scratchpad||'';const saved=el('p','save-status','输入后自动保存到此设备');saved.id='scratch-status';area.oninput=()=>{study.scratchpad=area.value;schedule('scratchpad','/api/scratchpad',{text:area.value});};target.append(area,saved);}
function downloadBackup(text){const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='国考精选-笔记-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function exportNotes(){try{await flush();study=loadStudy(localStorage);downloadBackup(JSON.stringify(study,null,2));toast('请将备份保存到“文件”或 iCloud 云盘');}catch(e){downloadBackup(JSON.stringify(questionBoard?.snapshot()||study,null,2));toast('已导出当前页面笔记；设备保存仍需检查');}}
function helpModal(){const target=openModal('怎样用得顺手');for(const[title,body]of[
 ['读卡片更方便','申论卡直接阅读和背诵素材；其他知识卡保留要点、练习、笔记三个页签。可调大字号、遮住要点回忆、复制背诵段。已有笔记可从“我的 → 查看本机全部笔记”找到。搜索找不到时，可保留关键词到全部知识里搜索。'],
 ['像 App 一样打开','用 iPhone 的 Safari 打开本站，在“共享”中选择“添加到主屏幕”，再点“添加”。建议固定从这个入口使用。'],
 ['每天积累一点，再主动回忆','从“词语辨析”说清一组词的区别；从“执法申论”先选熟悉且贴题的案例，再选一句背景句或名言，用自己的话说明它如何支持观点。原有五位一体案例放在拓展素材里。练习先想再看答案，收藏不熟悉的，到“复习”集中回忆。'],
 ['错题库，题目和解析一起看','把试卷名称、题号或截图发给张菁伟，他转交后核对原题并整理解析，再统一更新到这里。打开“阅读解析”即可复习，按“未弄懂”筛选，在题目里记错因、标记已弄懂；无需自己录入。想先记住题号，可用“临时记题”。题目与解析公开，自己的笔记和掌握记录只存本机。'],
 ['先重做，再读解析','在错题库选择“独立重做”，先选答案，按需要记录确定、犹豫或猜测，再提交查看解析。今日队列按本机日期和 1、3、7、14 天间隔安排；答错次日重做。已弄懂仍是你的主观标记，不等于复测通过。材料不全、待核或有争议的题暂不判分、不计正确率。'],
 ['笔记属于你自己','笔记和进度只存当前设备的浏览器，不上传，也不会让其他访客看到。不同设备不会自动同步。'],
 ['备份，放在“我的”','在“我的 → 备份笔记”保存文件。更换设备、浏览器或入口前先备份，再导入。清除网站数据会影响笔记，无痕浏览不适合长期保存。'],
 ['其他模块，也在知识库','资料分析、判断推理、言语理解和数量关系仍可从“知识库”进入。精选卡帮助积累与理解，完整备考还需配合考试大纲和历年真题。']])target.append(el('h3','',title),el('p','modal-caption',body));const a=el('a','','Apple 官方主屏幕操作说明 ↗');a.href='https://support.apple.com/zh-cn/guide/iphone/iph42ab2f3a7/ios';a.target='_blank';a.rel='noopener noreferrer';target.append(a);}
async function init(){try{[library,study]=await Promise.all([api('/api/library'),api('/api/state')]);library.cards.sort((a,b)=>categories.indexOf(a.category)-categories.indexOf(b.category)||(a.category==='申论'?(Number(b.kind==='recitation')*2+Number(b.kind==='material'))-(Number(a.kind==='recitation')*2+Number(a.kind==='material')):0)||a.priority-b.priority);$('#updated-at').textContent=library.reviewedAt.replaceAll('-','.');$('#total-cards').textContent=library.cards.length;$('#intro-text').textContent=library.cards.length+' 张精选积累卡：词语辨析、行政执法背诵、政治理论与常识。';
 questionBoard=createQuestionBoard({getStudy:()=>study,setStudy:value=>{study=value;},openModal,closeModal,toast,navigate});
 $('.skip-link').onclick=e=>{e.preventDefault();$('#main-content').focus({preventScroll:true});};
 document.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>navigate(b.dataset.screen));document.querySelectorAll('a[href="#home"]').forEach(a=>a.onclick=e=>{e.preventDefault();navigate('home');});document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{review=b.dataset.review;rememberPanel();nav();renderReview();});
 $('#library-sort').value=uiState.librarySort==='recent'?'recent':'priority';$('#library-sort').onchange=()=>{saveUI({librarySort:$('#library-sort').value});list(matching());};$('#search-everywhere').onclick=searchEverywhere;
 $('#search').oninput=()=>{rememberPanel();list(matching());};$('#filter').onchange=()=>{rememberPanel();list(matching());};$('#library-reset').onclick=resetLibrary;$('#help-btn').onclick=helpModal;$('#sources-btn').onclick=sourceModal;$('#scratchpad-btn').onclick=scratchModal;$('#back-list').onclick=backFromReader;document.querySelectorAll('[data-reader-tab]').forEach(b=>b.onclick=()=>setReaderTab(b.dataset.readerTab));$('#reader-font').onclick=()=>{saveUI({largeText:!uiState.largeText});applyReaderFont();};applyReaderFont();
 $('#export-btn').onclick=exportNotes;$('#import-btn').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{await flush();const result=await api('/api/import',JSON.parse(await file.text()));study=result.state;renderPanels();toast('已合并 '+result.count+' 条知识记录、'+(result.questionCount||0)+' 道问题、'+(result.answerNoteCount||0)+' 条解析复盘、'+(result.reviewAttemptCount||0)+' 次复测');if(result.warnings?.length){const box=openModal('备份合并说明');result.warnings.forEach(t=>box.append(el('p','modal-caption',t)));}}catch(e){toast('导入失败：'+e.message);}finally{$('#import-file').value='';}};
 $('#close-modal').onclick=closeModal;$('#modal').addEventListener('cancel',e=>{e.preventDefault();closeModal();});$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('#modal').open){e.preventDefault();if(screen==='qa')$('#qa-search').focus();else{if(screen!=='library')navigate('library');$('#search').focus();}}});history.scrollRestoration='manual';addEventListener('popstate',routeChanged);addEventListener('hashchange',routeChanged);renderPanels();routeChanged();addEventListener('beforeunload',e=>{if(pending.size||activeSaves.size||questionBoard?.hasUnsaved()){e.preventDefault();e.returnValue='';}});
 }catch(e){showScreen('reading');$('#reader').replaceChildren(el('h2','','资料库暂时无法读取'),el('p','text',e.message));$('#reader-progress').textContent='加载失败';$('#jump-note').hidden=true;$('#next-card').hidden=true;$('#back-list').onclick=()=>location.reload();const b=el('button','quiet-btn','导出当前设备原始笔记');b.onclick=()=>{try{const raw=localStorage.getItem('guokao-2027-study-v1');if(raw)downloadBackup(raw);else toast('当前设备没有已保存笔记');}catch(err){toast('浏览器暂时不允许读取笔记');}};const retry=el('button','primary-btn','重新加载');retry.onclick=()=>location.reload();const actions=el('div','load-actions');actions.append(retry,b);$('#reader').append(actions);}
}
init();
