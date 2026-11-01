export const STORE_KEY='med-study-room-v1';
export const emptyState=()=>({version:1,cards:{},questions:{},notes:{},stars:[],reads:{},activity:{},last:null,session:null,largeText:false});
export function dayKey(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
export function grade(question,answer){
 if(question.question_type==='short_answer')return null;
 const normalized=x=>Array.isArray(x)?[...new Set(x.map(String))].sort().join(','):String(x??'').replace(/\s/g,'').split(',').sort().join(',');
 const expected=question.question_type==='true_false'?String(question.correct_answer).toLowerCase().replace(/^t$/,'true').replace(/^f$/,'false'):question.correct_answer;
 return normalized(answer)===normalized(expected);
}
export function recordCard(state,id,rating,now=Date.now()){
 if(!['again','familiar','known'].includes(rating))throw Error('Invalid rating');
 const previous=state.cards[id]||{};
 const interval=rating==='again'?0:rating==='familiar'?1:Math.min(30,Math.max(3,(previous.interval||1)*2));
 state.cards[id]={rating,interval,due:now+interval*86400000,at:now,reviews:(previous.reviews||0)+1};
 const day=dayKey(new Date(now));state.activity[day]??={cards:[],questions:[]};
 if(!state.activity[day].cards.includes(id))state.activity[day].cards.push(id);
 return state.cards[id];
}
export function recordQuestion(state,id,answer,correct,now=Date.now(),self=false){
 const previous=state.questions[id]||{};
 state.questions[id]={answer,correct,at:now,attempts:(previous.attempts||0)+1,self};
 const day=dayKey(new Date(now));state.activity[day]??={cards:[],questions:[]};
 if(!state.activity[day].questions.includes(id))state.activity[day].questions.push(id);
}
export function shuffle(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function cardQueue(cards,state,mode='all',now=Date.now()){
 if(mode==='new')return cards.filter(c=>!state.cards[c.id]);
 if(mode==='due')return cards.filter(c=>state.cards[c.id]&&state.cards[c.id].due<=now).sort((a,b)=>state.cards[a.id].due-state.cards[b.id].due);
 if(mode==='starred')return cards.filter(c=>state.stars.includes(c.id));
 return cards;
}
