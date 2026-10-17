import {loadStudy,saveCard,saveScratchpad,mergeStudy} from './storage.js';
const $=s=>document.querySelector(s);
const categories=['资料分析','判断推理','政治理论','法律常识','申论','言语理解','数量关系','科技常识'];
const symbols=['chart','logic','flag','law','pen','chat','number','science'];
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const icon=name=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg'),u=document.createElementNS('http://www.w3.org/2000/svg','use');u.setAttribute('href','#i-'+name);s.setAttribute('aria-hidden','true');s.append(u);return s;};
let library,study,selected,category='全部精选',screen='home',review='starred',lastRead='',returnScreen='home',returnY=0,toastTimer;
const pending=new Map(),activeSaves=new Set(),latestTasks=new Map(),toggleVersions=new Map();
const UI_KEY='guokao-2027-ui-v1';
try{lastRead=JSON.parse(localStorage.getItem(UI_KEY)||'{}').lastRead||'';}catch{}
const toast=text=>{clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);};
function tracked(p){activeSaves.add(p);p.then(()=>activeSaves.delete(p),()=>activeSaves.delete(p));return p;}
function getCardState(id){return study.cards[id]||{note:'',starred:false,mastered:false};}
const flat=c=>[c.title,c.category,c.summary,c.why,...c.tags,...c.sections.map(s=>s.heading+' '+s.body),c.example.question,c.example.answer,c.example.explanation,...c.pitfalls,getCardState(c.id).note].join(' ').toLowerCase();
async function api(url,data){
 if(url==='/api/library'){const r=await fetch('./library.json',{cache:'no-cache'});if(!r.ok)throw Error('资料暂时无法加载');return r.json();}
 if(url==='/api/state')return loadStudy(localStorage);
 const ids=library.cards.map(c=>c.id);
 if(url==='/api/card'){const state=saveCard(localStorage,data.id,data,ids);return {saved:true,card:state.cards[data.id]};}
 if(url==='/api/scratchpad'){saveScratchpad(localStorage,data.text);return {saved:true};}
 if(url==='/api/import')return mergeStudy(localStorage,data,ids);
 throw Error('未知操作');
}
function matching(){const words=$('#search').value.toLowerCase().trim().split(/\s+/).filter(Boolean),filter=$('#filter').value;return library.cards.filter(c=>{const s=getCardState(c.id);return(category==='全部精选'||c.category===category)&&(filter!=='mastered'||s.mastered)&&(filter!=='unlearned'||!s.mastered)&&words.every(w=>flat(c).includes(w));});}
function showScreen(name){screen=name;document.body.classList.toggle('reading',name==='reading');document.querySelectorAll('.screen').forEach(s=>s.hidden=s.id!==name+'-screen');document.querySelectorAll('[data-screen]').forEach(b=>{b.classList.toggle('active',b.dataset.screen===name);if(b.dataset.screen===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});}
function panelState(name=screen,y=window.scrollY){return {screen:name,category,query:$('#search').value,filter:$('#filter').value,review,scrollY:y};}
function rememberPanel(){if(screen!=='reading')history.replaceState({...history.state,...panelState()},'',location.href);}
function restorePanel(state){if(!state)return;category=['全部精选',...categories].includes(state.category)?state.category:'全部精选';$('#search').value=typeof state.query==='string'?state.query:'';$('#filter').value=['all','unlearned','mastered'].includes(state.filter)?state.filter:'all';review=['starred','noted','unlearned'].includes(state.review)?state.review:'starred';}
function rememberReading(id){lastRead=id;try{localStorage.setItem(UI_KEY,JSON.stringify({lastRead:id}));}catch{}}
function navigate(name,{replace=false,scroll=true}={}){if(!['home','library','review','me'].includes(name))name='home';const same=name===screen;rememberPanel();history[replace||same?'replaceState':'pushState'](panelState(name,scroll?0:window.scrollY),'','#'+name);showScreen(name);renderPanels();if(scroll)window.scrollTo(0,0);}
function openCard(id,{replace=false}={}){const c=library.cards.find(c=>c.id===id);if(!c)return;
 const fromPanel=screen!=='reading',canGoBack=fromPanel?!replace:history.state?.canGoBack===true;
 if(fromPanel){rememberPanel();returnScreen=screen;returnY=window.scrollY;}
 selected=id;rememberReading(id);
 history[replace?'replaceState':'pushState']({reading:true,canGoBack,returnScreen,returnY},'','#card='+encodeURIComponent(id));showScreen('reading');reader(c);window.scrollTo(0,0);
}
function syncRoute(){if(!library)return;const id=location.hash.match(/^#card=([a-z0-9-]+)$/)?.[1],c=library.cards.find(c=>c.id===id);if(c){selected=c.id;rememberReading(c.id);returnScreen=['home','library','review','me'].includes(history.state?.returnScreen)?history.state.returnScreen:'home';returnY=history.state?.returnY||0;showScreen('reading');reader(c);window.scrollTo(0,0);}else{const name=location.hash.slice(1),target=['home','library','review','me'].includes(name)?name:'home',state=history.state?.screen===target?history.state:null;restorePanel(state);showScreen(target);renderPanels();const y=state?.scrollY||0;requestAnimationFrame(()=>window.scrollTo(0,y));}}
function backFromReader(){if(history.state?.canGoBack===true)history.back();else navigate(returnScreen,{replace:true});}
function counts(){const states=library.cards.map(c=>getCardState(c.id));return {done:states.filter(s=>s.mastered).length,starred:states.filter(s=>s.starred).length,noted:states.filter(s=>s.note?.trim()).length};}
function nav(){const target=$('#navigation');target.replaceChildren();for(const cat of ['全部精选',...categories]){const b=el('button','side-btn'+(cat===category?' active':''),cat);b.setAttribute('aria-pressed',String(cat===category));b.onclick=()=>{category=cat;rememberPanel();renderPanels();};target.append(b);}
 const n=counts();$('#fav-count').textContent=n.starred;$('#note-count').textContent=n.noted;$('#todo-count').textContent=library.cards.length-n.done;
 $('#me-done').textContent=n.done;$('#me-starred').textContent=n.starred;$('#me-notes').textContent=n.noted;
 $('#progress-value').textContent=n.done+' / '+library.cards.length;$('#progress-bar').style.width=n.done/library.cards.length*100+'%';
 $('#review-hint').textContent=n.starred||n.noted?n.starred+' 张收藏 · '+n.noted+' 条笔记':'把收藏与笔记再过一遍';
 document.querySelectorAll('[data-review]').forEach(b=>{b.classList.toggle('active',b.dataset.review===review);b.setAttribute('aria-pressed',String(b.dataset.review===review));});
}
function cardButton(c,{compact=false,showNote=false}={}){const s=getCardState(c.id),b=el('button','knowledge-card'+(compact?' compact':''));b.setAttribute('aria-label',c.title);
 const meta=el('div','card-meta');meta.append(el('span','',c.category),el('span','priority-label',c.priority===1?'核心必会':'进阶补充'));
 const stateLine=el('div','card-state');stateLine.append(el('span',s.mastered?'learned':'',s.mastered?'✓ 已掌握':'○ 待掌握'));if(s.starred)stateLine.append(el('span','','★ 收藏'));if(s.note?.trim())stateLine.append(el('span','','有笔记'));
 b.append(meta,el('h3','',c.title),el('p','',showNote&&s.note?.trim()?'我的笔记：'+s.note:c.summary),stateLine);b.onclick=()=>openCard(c.id);return b;
}
function empty(target,title,text,action,label){const box=el('div','empty');box.append(icon('book'),el('h3','',title),el('p','',text));if(action){const b=el('button','quiet-btn',label);b.onclick=action;box.append(b);}target.append(box);}
function list(items){const target=$('#cards');target.replaceChildren();$('#category-title').textContent=category;$('#result-count').textContent=items.length+' 张知识卡';if(!items.length)empty(target,'没有找到相关知识','换个关键词，或清除分类与状态筛选。',()=>{$('#search').value='';$('#filter').value='all';category='全部精选';rememberPanel();renderPanels();},'清除筛选');else items.forEach(c=>target.append(cardButton(c)));}
function renderReview(){const target=$('#review-list');target.replaceChildren();const items=library.cards.filter(c=>{const s=getCardState(c.id);return review==='starred'?s.starred:review==='noted'?s.note?.trim():!s.mastered;});
 $('#review-description').textContent=review==='starred'?'主动收藏的重点，值得再看一遍。':review==='noted'?'带着自己写下的理解和错因复习。':'尚未标记为已掌握，按优先级逐个学。';
 if(!items.length)empty(target,review==='starred'?'还没有收藏':review==='noted'?'还没有知识点笔记':'所有卡片都已掌握',review==='unlearned'?'可以回看收藏，或用例题检查是否还记得。':'阅读时随手标记重点，这里会帮你收好。',()=>navigate('library'),'去知识库看看');
 else items.forEach(c=>target.append(cardButton(c,{showNote:review==='noted'})));
}
function renderHome(){const c=library.cards.find(c=>c.id===lastRead)||library.cards.find(c=>c.id==='logic-01'&&!getCardState(c.id).mastered)||library.cards.find(c=>!getCardState(c.id).mastered)||library.cards[0];
 const resumed=lastRead===c.id;$('#continue-label').textContent=resumed?'接着上次的阅读':'从核心知识开始';$('#continue-title').textContent=c.title;$('#continue-meta').textContent=c.category+' · '+(getCardState(c.id).mastered?'已掌握，回看巩固':'规则 → 例题 → 易错点');$('#continue-btn').replaceChildren(document.createTextNode(resumed?'继续阅读 ':'开始学习 '),icon('arrow'));$('#continue-btn').onclick=()=>openCard(c.id);
 const grid=$('#topic-grid');grid.replaceChildren();categories.forEach((cat,i)=>{const items=library.cards.filter(c=>c.category===cat),b=el('button','topic-card');const badge=el('span','topic-icon');badge.append(icon(symbols[i]));b.append(badge,el('span','topic-label',cat),el('span','topic-count',items.length+' 张知识卡'));b.onclick=()=>{category=cat;$('#search').value='';$('#filter').value='all';navigate('library');};grid.append(b);});
 const picks=$('#home-picks');picks.replaceChildren();for(const[cat,time,method]of [['判断推理','建议 3–5 分钟','写出一个推理关系，用例题检验自己。'],['言语理解','建议 3–5 分钟','读一段话，说清选项到底错在哪里。'],['资料分析','建议 10 分钟','拿纸笔算一道，再检查口径和分母。']]){const pool=library.cards.filter(c=>c.category===cat),c=pool.find(c=>!getCardState(c.id).mastered)||pool[0];const b=el('button','knowledge-card compact');b.append(el('span','edition',time),el('h3','',cat),el('p','',method),el('div','card-state','从「'+c.title.split('：')[0]+'」开始 →'));b.onclick=()=>openCard(c.id);picks.append(b);}
}
function renderPanels(){nav();renderHome();list(matching());renderReview();}
function status(id,text,error=false){const node=id==='scratchpad'?$('#scratch-status'):$('#reader').dataset.card===id?$('#note-status'):null;if(node){node.textContent=text;node.classList.toggle('error',error);}}
function saveTask(key,task){return tracked(performSave(key,task));}
async function performSave(key,task){pending.delete(key);try{await api(task.url,task.data);if(latestTasks.get(key)===task)status(key,'已保存到此设备');nav();}catch(e){status(key,'保存失败，请重试',true);toast('笔记尚未保存：'+e.message);if(latestTasks.get(key)===task&&!pending.has(key))pending.set(key,task);}}
function schedule(key,url,data){status(key,'保存中…');const task={url,data};latestTasks.set(key,task);pending.set(key,task);saveTask(key,task);}
async function flush(){for(const[key,task]of[...pending])await saveTask(key,task);await Promise.all([...activeSaves]);if(pending.size)throw Error('仍有未保存的笔记，请稍后重试');}
function refreshReaderActions(id){if($('#reader').dataset.card!==id)return;const s=getCardState(id);for(const[field,labelOn,labelOff]of[['starred','★ 已收藏','☆ 收藏'],['mastered','✓ 已掌握','标为已掌握']]){const b=$('#reader [data-action="'+field+'"]');if(b){b.textContent=s[field]?labelOn:labelOff;b.classList.toggle('on',s[field]);b.setAttribute('aria-pressed',String(s[field]));}}}
function toggle(id,field){return tracked(performToggle(id,field));}
async function performToggle(id,field){const key=id+':'+field,version=(toggleVersions.get(key)||0)+1;toggleVersions.set(key,version);const old=getCardState(id)[field],value=!old;study.cards[id]={...getCardState(id),[field]:value};refreshReaderActions(id);nav();try{await api('/api/card',{id,[field]:value});}catch(e){if(toggleVersions.get(key)===version){study.cards[id]={...getCardState(id),[field]:old};refreshReaderActions(id);nav();}toast('状态未保存：'+e.message);}}
function reader(c){const r=$('#reader');r.replaceChildren();r.dataset.card=c.id;const s=getCardState(c.id),heading=el('div','reader-heading'),actions=el('div','reader-actions');
 for(const field of ['starred','mastered']){const b=el('button','icon-btn');b.dataset.action=field;b.onclick=()=>toggle(c.id,field);actions.append(b);}
 heading.append(el('span','reader-meta',c.category+' · '+c.origin),actions);r.append(heading,el('h2','',c.title),el('p','summary',c.summary));if(c.why)r.append(el('p','why','为什么要学：'+c.why));
 for(const section of c.sections)r.append(el('h3','',section.heading),el('div','text',section.body));
 const example=el('section','example');example.append(el('span','label','自编小例题 · 先想一想'),el('p','',c.example.question));const details=el('details');details.append(el('summary','','查看答案与解释'),el('p','',c.example.answer),el('p','',c.example.explanation));example.append(details);r.append(example);
 r.append(el('h3','','容易错在哪里'));const ul=el('ul');c.pitfalls.forEach(t=>ul.append(el('li','',t)));r.append(ul);
 const nh=el('div','note-heading');nh.append(el('h3','','我的笔记'));const saved=el('span','save-status',pending.has(c.id)?'尚有未保存内容':'输入后自动保存到此设备');saved.id='note-status';nh.append(saved);
 const box=el('textarea','note-box');box.id='card-note';box.setAttribute('aria-label','我的知识点笔记');box.placeholder='用自己的话总结规则，记下错因或疑问…';box.value=s.note||'';box.oninput=()=>{study.cards[c.id]={...getCardState(c.id),note:box.value};schedule(c.id,'/api/card',{id:c.id,note:box.value});};const retry=el('button','text-btn','立即保存');retry.onclick=()=>{schedule(c.id,'/api/card',{id:c.id,note:box.value});flush().catch(e=>toast(e.message));};r.append(nh,box,retry);
 const refs=el('details','reader-sources');refs.append(el('summary','','来源与核对依据'));const sources=el('div','source-list');for(const source of c.sources){if(!/^https?:\/\//.test(source.url))continue;const a=el('a','',(source.role||'来源')+' · '+source.title+' ↗');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';sources.append(a);}refs.append(sources,el('p','reader-meta','核对日期 '+c.reviewedAt));r.append(refs);
 refreshReaderActions(c.id);const index=library.cards.findIndex(x=>x.id===c.id);$('#reader-progress').textContent=c.category+' · '+(index+1)+' / '+library.cards.length;
 const next=library.cards[index+1];$('#next-card').textContent=next?'下一张：'+next.title:'已到最后一张 · 返回知识库';$('#next-card').onclick=()=>next?openCard(next.id,{replace:true}):navigate('library',{replace:true});
}
function openModal(title){$('#modal-title').textContent=title;$('#modal-content').replaceChildren();$('#modal').showModal();return $('#modal-content');}
function sourceModal(){const content=openModal('资料怎样进入这个库');content.append(el('p','modal-caption','先按考试范围筛选，再核对规则与适用条件。数学和逻辑例题重新演算；政策法律使用官方文本。资料多不等于值得背，未经核实的万能口诀不收录。'));for(const audit of library.sourceAudit){const card=el('section','modal-card');card.append(el('h3','',audit.title+' · '+audit.verdict),el('p','',audit.reason));const ul=el('ul');audit.limitations.forEach(s=>ul.append(el('li','',s)));card.append(ul);const a=el('a','','打开资料来源 ↗');a.href=audit.url;a.target='_blank';a.rel='noopener noreferrer';card.append(a,el('p','','许可说明：'+audit.license));content.append(card);}const official=el('section','modal-card');official.append(el('h3','','官方范围与考试年度'),el('p','',library.exam.note||'2027是考试年度，公共科目笔试在2026年举行。'));for(const source of library.exam.sources||[]){const a=el('a','',source.title+' ↗');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';const p=el('p');p.append(a);official.append(p);}content.append(official);}
function scratchModal(){const target=openModal('随手记');target.append(el('p','modal-caption','记下整体复习计划或跨知识点的疑问。只保存在当前设备，请定期备份。'));const area=el('textarea','note-box');area.id='scratchpad';area.setAttribute('aria-label','随手笔记');area.value=study.scratchpad||'';const saved=el('p','save-status','输入后自动保存到此设备');saved.id='scratch-status';area.oninput=()=>{study.scratchpad=area.value;schedule('scratchpad','/api/scratchpad',{text:area.value});};target.append(area,saved);}
function downloadBackup(text){const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='国考精选-笔记-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function exportNotes(){try{await flush();downloadBackup(JSON.stringify(study,null,2));toast('请将备份保存到“文件”或 iCloud 云盘');}catch(e){downloadBackup(JSON.stringify(study,null,2));toast('已导出当前页面笔记；设备保存仍需检查');}}
function helpModal(){const target=openModal('怎样用得顺手');for(const[title,body]of[
 ['像 App 一样打开','用 iPhone 的 Safari 打开本站，在“共享”中选择“添加到主屏幕”，再点“添加”。建议固定从这个入口使用。'],
 ['学、想、记，再复习','从“学习”开始或在“知识库”找模块。先读规则，自己想例题，再展开答案。收藏重点、记下错因后，到“复习”集中回看。'],
 ['笔记属于你自己','笔记和进度只存当前设备的浏览器，不上传，也不会让其他访客看到。不同设备不会自动同步。'],
 ['备份，放在“我的”','在“我的 → 备份笔记”保存文件。更换设备、浏览器或入口前先备份，再导入。清除网站数据会影响笔记，无痕浏览不适合长期保存。'],
 ['精选卡不是完整题库','本库重点是理解核心规则。例题为自编，正式备考还需结合考试大纲和历年真题。']])target.append(el('h3','',title),el('p','modal-caption',body));const a=el('a','','Apple 官方主屏幕操作说明 ↗');a.href='https://support.apple.com/zh-cn/guide/iphone/iph42ab2f3a7/ios';a.target='_blank';a.rel='noopener noreferrer';target.append(a);}
async function init(){try{[library,study]=await Promise.all([api('/api/library'),api('/api/state')]);library.cards.sort((a,b)=>categories.indexOf(a.category)-categories.indexOf(b.category)||a.priority-b.priority);$('#updated-at').textContent=library.reviewedAt.replaceAll('-','.');$('#total-cards').textContent=library.cards.length;$('#intro-text').textContent=library.cards.length+' 张精华知识卡，写清规则、例题与误区。';
 document.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>navigate(b.dataset.screen));document.querySelectorAll('a[href="#home"]').forEach(a=>a.onclick=e=>{e.preventDefault();navigate('home');});document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{review=b.dataset.review;rememberPanel();nav();renderReview();});
 $('#search').oninput=()=>{rememberPanel();list(matching());};$('#filter').onchange=()=>{rememberPanel();list(matching());};$('#help-btn').onclick=helpModal;$('#sources-btn').onclick=sourceModal;$('#scratchpad-btn').onclick=scratchModal;$('#back-list').onclick=backFromReader;$('#jump-note').onclick=()=>{$('#card-note').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});$('#card-note').focus({preventScroll:true});};
 $('#export-btn').onclick=exportNotes;$('#import-btn').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{await flush();const result=await api('/api/import',JSON.parse(await file.text()));study=result.state;renderPanels();toast('已合并 '+result.count+' 条学习记录，原笔记已保留');}catch(e){toast('导入失败：'+e.message);}finally{$('#import-file').value='';}};
 $('#close-modal').onclick=()=>$('#modal').close();$('#modal').addEventListener('close',()=>flush().catch(e=>toast(e.message)));$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))$('#modal').close();});
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('#modal').open){e.preventDefault();if(screen!=='library')navigate('library');$('#search').focus();}});history.scrollRestoration='manual';addEventListener('popstate',syncRoute);addEventListener('hashchange',syncRoute);renderPanels();syncRoute();addEventListener('beforeunload',e=>{if(pending.size||activeSaves.size){e.preventDefault();e.returnValue='';}});
 }catch(e){showScreen('reading');$('#reader').replaceChildren(el('h2','','资料库暂时无法读取'),el('p','text',e.message));$('#reader-progress').textContent='加载失败';$('#jump-note').hidden=true;$('#next-card').hidden=true;$('#back-list').onclick=()=>location.reload();const b=el('button','quiet-btn','导出当前设备原始笔记');b.onclick=()=>{try{const raw=localStorage.getItem('guokao-2027-study-v1');if(raw)downloadBackup(raw);else toast('当前设备没有已保存笔记');}catch(err){toast('浏览器暂时不允许读取笔记');}};$('#reader').append(b);}
}
init();
