export const PARTS=['逻辑填空','片段阅读','语句表达','图形推理'];
export const EXAMS={guokao:'国考',fujian:'福建省考',shiye:'福建事业单位',supplement:'补充练习 / 模考'};
export const GUIDES={
 '图形推理':'先观察图形整体与差异，再核对数量、位置、属性或空间关系。点图片可看原图；未载入完整时先不要作答。',
 '逻辑填空':'选词、选成语：先找上下文限制，再比较词义、搭配和程度。',
 '片段阅读':'主旨、意图、细节、标题、词句理解；材料阅读里的独立小题也按设问分类。',
 '语句表达':'语句排序、句子填空、句子插入、下文推断、病句辨析。边界题保留复核说明。'
};
export function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function validateBank(data){
 if(!data||data.schema!==1||!Array.isArray(data.papers)||!Array.isArray(data.items)||!Array.isArray(data.explained))throw Error('言语目录格式不正确');
 const papers=new Set(),ids=new Set();
 for(const p of data.papers){if(!p.id||papers.has(p.id)||!EXAMS[p.exam]||!Number.isInteger(p.year)||!safeUrl(p.url))throw Error('试卷出处不完整');papers.add(p.id);}
 for(const q of data.items){if(!q.id||ids.has(q.id)||!PARTS.includes(q.part)||!q.occurrences?.length)throw Error('题目目录不完整');ids.add(q.id);for(const o of q.occurrences){if(!papers.has(o.paperId)||(!Number.isInteger(o.moduleNumber)&&!Number.isInteger(o.originalNumber))||o.originalNumber===0)throw Error('题号与试卷无法对应');}}
 return data;
}
export function numberLabel(o){if(o.numbering==='selection')return '精选页第 '+o.sourceNumber+' 题（非原卷号）';return Number.isInteger(o.originalNumber)?'来源卷第 '+o.originalNumber+' 题':'言语模块第 '+o.moduleNumber+' 题（非原卷号）';}
export function matchesQuery(query,item,p,o){const raw=String(query||'').trim().toLowerCase(),number=raw.match(/^(?:第\s*)?(\d{1,3})(?:\s*题)?$/),qid=raw.match(/^qid\s*[:：]\s*(\d+)$/);if(number)return [o.originalNumber,o.moduleNumber,o.sourceNumber].includes(Number(number[1]));if(qid)return String(o.qid||'')===qid[1];return raw.split(/\s+/).filter(Boolean).every(t=>[p.title,p.year,numberLabel(o),item.part,item.subtype].join(' ').toLowerCase().includes(t));}
export function matchingOccurrences(item,papers,filters){return item.occurrences.filter(o=>{const p=papers.get(o.paperId);return p&&(filters.exam==='all'||p.exam===filters.exam)&&(filters.year==='all'||p.year===Number(filters.year))&&matchesQuery(filters.query,item,p,o);});}
export function filterItems(items,papers,filters){return items.filter(q=>q.part===filters.part).map(q=>({...q,matched:matchingOccurrences(q,papers,filters)})).filter(q=>q.matched.length);}
export function sourceLink(p,o){return safeUrl(o.sourceUrl)||safeUrl(p.url);}
export function requestText(item,paper,occurrence){return ['给张菁伟发微信~qaq','试卷：'+paper.title,'题型：'+item.part+' · '+item.subtype,'定位：'+numberLabel(occurrence),occurrence.qid?'来源题目编号：'+occurrence.qid:'','原题入口：'+sourceLink(paper,occurrence),'我的疑问：','请结合完整题面和选项讲解，核实原卷题号后加入错题库。'].filter(Boolean).join('\n');}
export function csvCell(value){const s=String(value??'');return '"'+(/^[=+@-]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';}
export function toCsv(items,papers){const rows=[['分类','子题型','试卷','年度','来源卷题号（未核官方原卷）','模块序号','精选页序号','来源系统编号','来源','状态']];for(const q of items)for(const o of q.matched||q.occurrences){const p=papers.get(o.paperId);rows.push([q.part,q.subtype,p.title,p.year,o.originalNumber??'',o.moduleNumber??'',o.numbering==='selection'?o.sourceNumber:'',o.qid??'',sourceLink(p,o),'仅索引；未独立解答']);}return '\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');}
