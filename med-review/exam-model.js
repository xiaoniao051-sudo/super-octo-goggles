export const freshExamState=()=>({session:null,records:{},history:[]});
export function sameChoices(actual,expected){
 if(!Array.isArray(actual)||!Array.isArray(expected)||!expected.length)return false;
 const norm=x=>[...new Set(x.map(String))].sort().join('|');
 return norm(actual)===norm(expected);
}
export function rubricScore(q,values=[]){
 return q.rubric.reduce((total,r,i)=>total+Math.max(0,Math.min(r.points,Number.isFinite(Number(values[i]))?Math.floor(Number(values[i])):0)),0);
}
export function currentRecord(q,records){const r=records[q.id];return r&&r.version===q.version?r:null;}
export function selectPractice(bank,records,{course='all',mode='daily',minutes=20,count=3,type='all'}={},now=Date.now()){
 let pool=bank.filter(q=>(course==='all'||q.course===course)&&(type==='all'||q.type===type));
 if(mode==='wrong')pool=pool.filter(q=>{const r=currentRecord(q,records);return r&&r.score<q.points;});
 const priority=q=>{const r=currentRecord(q,records);return !r?1:r.score<q.points&&r.due<=now?0:r.due<=now?2:r.score<q.points?3:4;};
 const selected=[],types=new Set(),usedCourses=new Set();let used=0;
 while(pool.length&&selected.length<(mode==='timed'?6:count)){
  pool.sort((a,b)=>priority(a)-priority(b)||(course==='all'?Number(usedCourses.has(a.course))-Number(usedCourses.has(b.course)):0)||Number(types.has(a.type))-Number(types.has(b.type))||(currentRecord(a,records)?.at||0)-(currentRecord(b,records)?.at||0)||a.id.localeCompare(b.id));
  let index=mode==='timed'?pool.findIndex(q=>used+q.minutes<=minutes):0;
  if(index<0){if(selected.length)break;index=0;}
  const q=pool.splice(index,1)[0];selected.push(q);used+=q.minutes;types.add(q.type);usedCourses.add(q.course);
 }
 return selected;
}
export function newExamSession(items,{course='all',mode='daily',minutes=20}={},now=Date.now()){
 if(!items.length)return null;
 return {id:'practice-'+now,ids:items.map(q=>q.id),versions:Object.fromEntries(items.map(q=>[q.id,q.version])),course,mode,minutes,index:0,answers:{},choices:{},paper:{},grades:{},confirmed:{},reasons:{},startedAt:now,deadline:mode==='timed'?now+minutes*60000:null,submittedAt:null};
}
export function reconcileExam(raw,bank){
 const out={...freshExamState(),...(raw||{})};out.records=raw?.records||{};out.history=Array.isArray(raw?.history)?raw.history:[];
 const map=new Map(bank.map(q=>[q.id,q])),s=out.session;
 if(s&&(!Array.isArray(s.ids)||!s.ids.length||s.ids.some(id=>!map.has(id)||s.versions?.[id]!==map.get(id).version)))out.session=null;
 return out;
}
export function answeredCount(s,bank){const map=new Map(bank.map(q=>[q.id,q]));return s.ids.filter(id=>map.get(id)?.choice?s.choices[id]?.length:(s.answers[id]||'').trim()||s.paper[id]).length;}
export function confirmPractice(exam,q,now=Date.now()){
 const s=exam.session;if(!s?.submittedAt||!s.ids.includes(q.id))return null;
 const previous=currentRecord(q,exam.records),score=q.choice?(sameChoices(s.choices[q.id]||[],q.choice.correct)?q.points:0):rubricScore(q,s.grades[q.id]);
 const missed=q.rubric.map((r,i)=>({text:r.text,lost:q.choice?q.points-score:r.points-(Number(s.grades[q.id]?.[i])||0)})).filter(x=>x.lost>0);
 const record={version:q.version,score,max:q.points,at:now,due:now+(score<q.points?1:3)*86400000,attempts:(previous?.attempts||0)+(previous?.sessionId===s.id?0:1),sessionId:s.id,method:q.choice?'objective':'self_rubric',missed,reason:s.reasons[q.id]||''};
 exam.records[q.id]=record;s.confirmed[q.id]={score,at:now};
 return record;
}
export function submitExam(exam,bank,now=Date.now()){
 const s=exam.session;if(!s||s.submittedAt)return;
 s.submittedAt=now;s.index=0;
 for(const q of bank.filter(q=>s.ids.includes(q.id)&&q.choice))confirmPractice(exam,q,now);
}
export function examTotals(s,bank){
 const map=new Map(bank.map(q=>[q.id,q]));let score=0,max=0,assessedMax=0,assessed=0;
 for(const id of s.ids){const q=map.get(id);if(!q)continue;max+=q.points;if(s.confirmed[id]){score+=s.confirmed[id].score;assessedMax+=q.points;assessed++;}}
 return {score,max,assessedMax,assessed,total:s.ids.length,complete:assessed===s.ids.length};
}
export function archiveExam(exam,bank){
 const s=exam.session;if(!s?.submittedAt)return false;
 const totals=examTotals(s,bank);if(!totals.complete)return false;
 const row={id:s.id,course:s.course,mode:s.mode,startedAt:s.startedAt,submittedAt:s.submittedAt,...totals};
 exam.history=[row,...exam.history.filter(x=>x.id!==s.id)].slice(0,30);return true;
}
