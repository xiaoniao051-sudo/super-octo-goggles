import {inspectNotes,inspectionSummary} from './note-inspection.js?v=20261020-review1';
const $=s=>document.querySelector(s);
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const labels={cards:'知识卡笔记',answers:'错题解析笔记',questions:'临时记题',scratchpad:'随手记',draft:'记题草稿'};
async function metadata(path,key){try{const response=await fetch(path,{cache:'no-cache'});if(!response.ok)return [];const data=await response.json();return Array.isArray(data[key])?data[key]:[];}catch{return [];}}
async function start(){
 // Snapshot immediately, before optional title metadata can fail or be delayed.
 let storage;try{storage=localStorage;}catch{storage={getItem(){throw Error('blocked');}};}
 const snapshot=inspectNotes(storage);
 const headings={ok:'已读取当前入口的保存记录',missing:'当前入口未找到保存记录',invalid:'找到数据，但暂时无法解析',blocked:'浏览器暂时不允许读取'};
 const details={ok:'下面包含错题复盘和临时记题；首页的知识卡笔记数量没有统计这两类记录。',missing:'这不能证明所有笔记已被删除。请核对当时打开的网址是否也是本站，以及是否有以前导出的备份。',invalid:'请先备份原始数据，再交由排查。本页不会尝试覆盖或重置。',blocked:'本页未修改任何记录。请保留当前页面和原入口，暂时不要清理网站数据。'};
 $('#status-title').textContent=headings[snapshot.status];$('#status-detail').textContent=details[snapshot.status];
 const summary=inspectionSummary(snapshot,location.origin);$('#report').value=summary;
 $('#copy-report').disabled=false;$('#copy-report').onclick=async()=>{try{await navigator.clipboard.writeText(summary);$('#action-status').textContent='已复制检查结果，不含笔记正文。';}catch{$('#report').focus();$('#report').select();$('#action-status').textContent='请长按上面的检查结果，选择复制。';}};
 if(snapshot.raw!==null){$('#backup').disabled=false;$('#backup').onclick=()=>{const blob=new Blob([snapshot.raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='国考精选-原始笔记-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);$('#action-status').textContent='已发起下载，请确认文件保存成功。微信若未弹出保存，可展开笔记长按复制。';};}
 if(snapshot.raw!==null){const fallback=el('details');fallback.append(el('summary','无法下载？展开原始数据，长按复制备份'));const raw=el('textarea');raw.readOnly=true;raw.setAttribute('aria-label','只读原始笔记数据');fallback.append(el('p','这些是你的原始笔记数据，请保存给自己；排查时先发送上面的检查结果即可。'),raw);fallback.addEventListener('toggle',()=>{if(fallback.open)raw.value=snapshot.raw;});$('#backup').closest('section').append(fallback);}
 if(snapshot.status!=='ok')return;
 for(const[key,label]of Object.entries(labels)){const box=el('div');box.className='count';box.append(el('strong',snapshot.counts[key]),el('span',label));$('#counts').append(box);}
 const render=result=>{const target=$('#all-notes');target.replaceChildren();let total=0;for(const[key,items]of Object.entries(result.groups)){if(!items.length)continue;total+=items.length;const section=el('section');section.className='note-group';section.append(el('h2',labels[key]+' · '+items.length));for(const item of items){const detail=el('details');detail.append(el('summary',item.title),el('pre',item.text||'已保存试卷和题号，尚未填写复盘文字。'));section.append(detail);}target.append(section);}if(!total)target.append(el('p','当前记录中没有笔记正文或临时记题。收藏与掌握数量请看上面的检查结果。'));};
 render(snapshot);
 const [cards,answers]=await Promise.all([metadata('./library.json','cards'),metadata('./answers.json','answers')]);
 render(inspectNotes({getItem:()=>snapshot.raw},cards,answers));
}
start();
