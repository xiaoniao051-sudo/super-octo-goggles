// Original study explanations are separate from source questions and grading.
// A content/version stamp prevents attaching a rationale to a reordered edition.
export function explanationEvidenceKey(answer){
 const input=JSON.stringify([answer.id,answer.sourceVersion,answer.question?.stem,answer.question?.prompt,answer.question?.options,answer.correctOption]);
 let hex='';
 for(const seed of [0x811c9dc5,0x9e3779b9,0x85ebca6b,0xc2b2ae35]){
  let hash=seed;for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,0x01000193);}hex+=(hash>>>0).toString(16).padStart(8,'0');
 }
 return 've1-'+hex;
}
export function createExplanationIndex(data){
 if(data?.schemaVersion!==1||!Array.isArray(data.explanations))throw Error('言语解析格式无效');
 const map=new Map();
 for(const r of data.explanations){
  const wrong=['A','B','C','D'].filter(x=>x!==r.answer);
  if(!/^verbal-[a-z0-9]+$/.test(r.id)||map.has(r.id)||!/^ve1-[a-f0-9]{32}$/.test(r.evidenceKey)||!['A','B','C','D'].includes(r.answer)||!['explained','disputed'].includes(r.status)||typeof r.reason!=='string'||!r.reason.trim()||typeof r.tip!=='string'||!r.tip.trim()||typeof r.caution!=='string'||!r.distractors||Object.keys(r.distractors).length!==3||wrong.some(k=>typeof r.distractors[k]!=='string'||!r.distractors[k].trim())||(r.status==='disputed'&&!r.caution.trim()))throw Error('言语解析记录无效：'+r.id);
  map.set(r.id,r);
 }
 return map;
}
export function withExplanation(answer,index){
 const entry=index?.get(answer.id);
 if(!answer.sourceOnly||!entry||entry.evidenceKey!==explanationEvidenceKey(answer))return answer;
 const sections=[{heading:'最快判断',body:entry.tip},{heading:'为什么这样选',body:entry.reason},...Object.entries(entry.distractors).sort(([a],[b])=>a.localeCompare(b)).map(([letter,text])=>({heading:letter+' 项怎么比较',body:text}))];
 if(entry.caution)sections.push({heading:entry.status==='disputed'?'争议与边界':'注意这一点',body:entry.caution});
 return {...answer,explanation:entry,answer:(entry.status==='disputed'?'本站倾向：':'本站讲解：')+entry.answer+'。'+(entry.answer!==answer.correctOption?'来源参考为 '+answer.correctOption+'，两种判断的依据见下文。':''),sections};
}
