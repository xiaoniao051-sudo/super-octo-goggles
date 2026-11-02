export function normalizeEnglish(value){return String(value||'').normalize('NFKC').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[‐‑–]/g,'-').replace(/\s+/g,' ');}
export function gradeVocabulary(question,answer){
 if(!normalizeEnglish(answer))return null;
 if(question.gradingMode==='self')return 'self';
 return question.acceptedAnswers.some(x=>normalizeEnglish(x)===normalizeEnglish(answer));
}
export function vocabularyVersion(q){return JSON.stringify([q.prompt,q.acceptedAnswers,q.gradingMode]);}
export function vocabularyRecord(q,records){const r=records[q.id];return r?.version===vocabularyVersion(q)?r:null;}
export function vocabularySession(questions){return {ids:questions.map(q=>q.id),versions:Object.fromEntries(questions.map(q=>[q.id,vocabularyVersion(q)])),index:0,answers:{},results:{},startedAt:Date.now()};}
export function reconcileVocabulary(raw,questions){
 const state={records:{},session:null,...raw};state.records=state.records||{};
 const map=new Map(questions.map(q=>[q.id,q])),s=state.session;
 if(s&&(!Array.isArray(s.ids)||!s.ids.length||s.ids.some(id=>!map.has(id)||s.versions?.[id]!==vocabularyVersion(map.get(id)))))state.session=null;
 return state;
}
export function submitVocabulary(state,q,manual){
 const s=state.session;if(!s||!s.ids.includes(q.id)||Object.hasOwn(s.results,q.id))return null;
 const graded=gradeVocabulary(q,s.answers[q.id]);
 if(graded===null||graded==='self'&&typeof manual!=='boolean')return null;
 const correct=graded==='self'?manual:graded;
 const previous=vocabularyRecord(q,state.records);
 const row={correct,answer:s.answers[q.id],at:Date.now(),attempts:(previous?.attempts||0)+1,version:vocabularyVersion(q),self:graded==='self'};
 state.records[q.id]=row;s.results[q.id]=row;return row;
}
