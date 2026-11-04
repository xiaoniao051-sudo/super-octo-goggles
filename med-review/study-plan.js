import {currentRecord,needsRepair} from './exam-model.js?v=boost1';

export const typeLabels={single_choice:'单选',multi_choice:'多选',calculation:'计算分析',short_answer:'简答',case:'案例分析',translation:'英译汉',writing:'写作',reading:'阅读理解',essay:'论述',grammar:'语法',word_formation:'构词'};
export function practiceSummary(bank,records,course='all',now=Date.now()){
 const list=bank.filter(q=>course==='all'||q.course===course),done=list.filter(q=>currentRecord(q,records));
 return {total:list.length,done:done.length,due:done.filter(q=>currentRecord(q,records).due<=now).length,repair:list.filter(q=>needsRepair(q,records)).length,retested:done.filter(q=>currentRecord(q,records).score===q.points&&currentRecord(q,records).retestedAt).length};
}
export function typeSummary(bank,records,course){
 const list=bank.filter(q=>q.course===course),types=[...new Set(list.map(q=>q.type))];
 return types.map(type=>{const qs=list.filter(q=>q.type===type),done=qs.filter(q=>currentRecord(q,records));return {type,total:qs.length,done:done.length,score:done.reduce((n,q)=>n+currentRecord(q,records).score,0),max:done.reduce((n,q)=>n+q.points,0),repair:qs.filter(q=>needsRepair(q,records)).length};}).sort((a,b)=>b.repair-a.repair||a.done-b.done);
}
export function dailyCards(cards,state,course,now=Date.now(),count=6){
 const list=cards.filter(c=>c.course===course),rec=id=>state.cards[id];
 const due=list.filter(c=>rec(c.id)&&rec(c.id).due<=now).sort((a,b)=>rec(a.id).due-rec(b.id).due);
 // Foundation before textbook extensions; this is a study order, not an exam syllabus.
 const unseen=list.filter(c=>!rec(c.id)).sort((a,b)=>Number(a.topic.startsWith('拓展'))-Number(b.topic.startsWith('拓展')));
 return [...due,...unseen].slice(0,count);
}
export const verifiedLinks={
 EX01001:['C5283d08ac484','C20f6a7d2400e','Cbd488e71cb20'],
 EX01002:['Cb49d614f402c','Ca62194660018','C768e657b9ac7'],
 EX01010:['Cc4a098753ea3','C9bc723964ee1','C991851a66323'],
 EX06001:['C9e1b5e6678c2','C0c02e1497b00'],
 EX11001:['C8f82e21fc68d','C2b32fc3aa9e8'],
 EX3CT010:['Cc0b135744030','C5a2c10b26fdf']
};
export function relatedCards(q,cards){
 const ids=verifiedLinks[q.id];
 if(ids)return {label:'对应知识卡',cards:ids.map(id=>cards.find(c=>c.id===id&&c.course===q.course)).filter(Boolean)};
 return {label:'同资料页知识卡（供查阅）',cards:cards.filter(c=>c.course===q.course&&c.sourceId===q.sourceId&&(c.sourcePages||[c.page]).some(p=>q.sourcePages.includes(p))).slice(0,4)};
}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tactics={
 '01':['计算题写全步骤','先判资料类型和设计，再写方法、条件、计算、结论。今日新卡先学课程基础，教材“拓展”随后安排；顺序不代表必考范围。'],
 '05':['把时间留给阅读和听力','本期课外阅读占40%，听力占20%。词根词缀继续按组记；每天安排阅读或听力，翻译和写作也要动笔。'],
 '06':['闭卷列框架，再结合材料','先写总论点与分论点，再补概念和材料联系。注意资料的2018/2020版本，不能把旧表述直接当作本期唯一标准。'],
 '11':['按案例写推理与沟通步骤','抓线索、列依据、说下一步，再写面向患者或团队的具体表达。先练能独立写出的答案。']
};
export function planHtml({course,catalog,cards,state,bank,pending='',resume=''},now=Date.now()){
 const summary=practiceSummary(bank,state.exam.records,course,now),batch=dailyCards(cards,state,course,now),types=typeSummary(bank,state.exam.records,course),t=tactics[course];
 const day=new Date(now).toLocaleDateString('zh-CN',{month:'long',day:'numeric'});
 return `<a class="back" href="#home">‹ 我的科目</a><div class="page-heading"><div class="eyebrow">${day} · 一轮只做几件事</div><h1>今日提分</h1><p>先回忆，再闭卷输出，最后解决失分点。</p></div><div class="chips plan-courses" aria-label="选择今日复习科目">${catalog.courses.map(c=>`<a class="chip ${course===c.id?'active':''}" href="#exam?view=plan&course=${c.id}" ${course===c.id?'aria-current="page"':''}>${esc(c.short)}</a>`).join('')}</div>${resume}${pending}<section class="plan-focus"><span class="badge green">今天的重点</span><h2>${esc(t[0])}</h2><p>${esc(t[1])}</p></section><div class="plan-steps"><section class="panel plan-step"><span class="plan-number">01</span><h2>回忆 ${batch.length||'已学'} 张知识卡</h2><p>到期的优先，再补新知识。先说出要点，想不起来再展开。</p>${batch.length?`<button class="button primary" data-action="exam-plan-cards" data-course="${course}">开始这 ${batch.length} 张 →</button>`:'<a class="button" href="#review">查看温习记录</a>'}<small>按真实回忆自评；翻开不计掌握。</small></section><section class="panel plan-step"><span class="plan-number">02</span><h2>闭卷做 3 题</h2><p>到期题优先，搭配未做题。计算写步骤，简答写得分点。</p><button class="button primary" data-action="exam-plan-start" data-course="${course}" data-mode="daily">开始闭卷训练 →</button><small>草稿可续写；主观题按实际答案自评。</small></section><section class="panel plan-step"><span class="plan-number">03</span><h2>补漏，再隔天复测</h2><p>${summary.repair?`${summary.repair} 题有失分或待复测。订正后隔至少24小时再独立答一次。`:'核对后，失分题会出现在这里。不要把刚看过答案当成已经会了。'}</p><button class="button" data-action="exam-plan-start" data-course="${course}" data-mode="wrong" ${summary.repair?'':'disabled'}>失分与复测 →</button><small>复测通过仍会安排后续温习。</small></section></div><section class="stats-strip" aria-label="应用训练进度"><div class="stat"><strong>${summary.done}/${summary.total}</strong><span>已核对应用题</span></div><div class="stat"><strong>${summary.due}</strong><span>到期复测</span></div><div class="stat"><strong>${summary.retested}</strong><span>隔天复测通过</span></div></section><section class="panel"><h2>哪里还容易丢分</h2><p class="small-copy">按最近一次已确认评分统计。未做不等于不会，满分一次也不等于掌握；主观题含本人自评。</p><div class="plan-types">${types.map(x=>`<div class="plan-type"><div><strong>${esc(typeLabels[x.type]||x.type)}</strong><p>${x.done?`已练 ${x.done}/${x.total} 题 · 最近得分点 ${x.score}/${x.max}`:`未练 · 共 ${x.total} 题`}${x.repair?` · ${x.repair} 题待补漏`:''}</p></div><button class="button small" data-action="exam-plan-type" data-course="${course}" data-type="${x.type}">专项练</button></div>`).join('')}</div></section>${course==='05'?'<section class="panel"><h2>英语每天另外留一小段时间</h2><p class="small-copy">应用题不含完整听力试卷；到英语备考页练原音频与六单元词汇。</p><div class="practice-actions"><a class="button" href="#english?tab=listening">听力练习</a><a class="button" href="#english?tab=vocab">词汇填空</a><a class="button" href="#english?tab=reading">六单元课文</a></div></section>':''}<p class="small-copy">这是一轮学习建议，不是必须打卡的任务；可以分几次完成。训练得分不预测考试分数。</p><a class="button" href="#exam?course=${course}">更多题目与限时训练</a>`;
}
