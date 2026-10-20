import {STATE_KEY,loadStudy} from './storage.js?v=20261020-review2';

// Read one snapshot only. Inspection must never initialize, repair or save storage.
export function inspectNotes(storage,cards=[],answers=[]){
 let raw;
 try{raw=storage.getItem(STATE_KEY);}catch{return {status:'blocked',raw:null};}
 if(raw===null)return {status:'missing',raw:null};
 if(!raw)return {status:'invalid',raw};
 let state;
 try{state=loadStudy({getItem:()=>raw});}catch{return {status:'invalid',raw};}
 const cardNames=new Map(cards.filter(c=>c&&typeof c.id==='string').map(c=>[c.id,c.title]));
 const answerNames=new Map(answers.filter(a=>a&&typeof a.id==='string').map(a=>[a.id,[a.paper,a.title||('第'+a.number+'题')].filter(Boolean).join(' · ')]));
 const groups={cards:[],answers:[],questions:[],scratchpad:[],draft:[]};
 const hasText=v=>typeof v==='string'&&v.trim().length>0;
 for(const[id,item]of Object.entries(state.cards))if(hasText(item.note))groups.cards.push({id,title:cardNames.get(id)||'知识卡记录 · '+id,text:item.note});
 for(const[id,item]of Object.entries(state.answerNotes))if(hasText(item.note))groups.answers.push({id,title:answerNames.get(id)||'错题解析记录 · '+id,text:item.note});
 for(const[id,item]of Object.entries(state.questions)){
  const text=[['我的疑问',item.doubt],['我的作答',item.myAnswer],['复盘笔记',item.note],['题目',item.stem],['科目',item.subject],['来源',item.source]].filter(([,value])=>hasText(value)).map(([label,value])=>label+'：'+value).join('\n\n');
  groups.questions.push({id,title:item.paper+' · 第'+item.number+'题',text});
 }
 if(hasText(state.scratchpad))groups.scratchpad.push({title:'随手记',text:state.scratchpad});
 const draftText=Object.entries(state.questionDraft||{}).filter(([,value])=>hasText(value)).map(([key,value])=>({paper:'试卷',number:'题号',subject:'科目',source:'来源',myAnswer:'我的作答',doubt:'我的疑问',stem:'题目'}[key]||key)+'：'+value).join('\n\n');
 if(draftText)groups.draft.push({title:'临时记题草稿',text:draftText});
 const counts=Object.fromEntries(Object.entries(groups).map(([key,items])=>[key,items.length]));
 counts.starred=Object.values(state.cards).filter(c=>c.starred).length;
 counts.mastered=Object.values(state.cards).filter(c=>c.mastered).length;
 counts.understood=Object.values(state.answerNotes).filter(c=>c.mastered).length;
 return {status:'ok',raw,groups,counts,updatedAt:state.updatedAt};
}

export function inspectionSummary(result,origin){
 const status={ok:'可读取',missing:'当前入口未找到保存记录',invalid:'有数据，但格式无法读取',blocked:'浏览器不允许读取'}[result.status];
 const lines=['本机笔记检查','站点：'+origin,'状态：'+status];
 if(result.status==='ok'){
  const c=result.counts;
  lines.push('知识卡笔记：'+c.cards,'错题解析笔记：'+c.answers,'临时记题：'+c.questions,'随手记：'+c.scratchpad,'记题草稿：'+c.draft,'知识卡收藏 / 掌握：'+c.starred+' / '+c.mastered,'解析已弄懂：'+c.understood,'最近保存：'+(result.updatedAt||'无时间记录'));
 }
 return lines.join('\n');
}
