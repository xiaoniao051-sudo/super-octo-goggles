// Pure display helpers. Learning data remains owned by storage.js.
export function searchWords(query='') { return query.toLowerCase().trim().split(/\s+/).filter(Boolean); }
export function searchExcerpt(card,query,note='') {
 const words=searchWords(query);
 if(!words.length)return card.summary;
 const parts=[card.summary,card.recite,...(card.sections||[]).map(s=>s.heading+'：'+s.body),card.example?.question,card.example?.answer,card.example?.explanation,...(card.pitfalls||[]),note&&'我的笔记：'+note].filter(Boolean);
 const hit=parts.find(p=>words.some(w=>p.toLowerCase().includes(w)))||card.summary;
 const index=Math.min(...words.map(w=>hit.toLowerCase().indexOf(w)).filter(i=>i>=0));
 const start=Number.isFinite(index)?Math.max(0,index-28):0;
 return (start?'…':'')+hit.slice(start,start+125)+(hit.length>start+125?'…':'');
}
export function orderCards(cards,order='priority') {
 return order==='recent'?[...cards].sort((a,b)=>(b.reviewedAt||'').localeCompare(a.reviewedAt||'')):cards;
}
