const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[char]);

const tracks = {
  vocabulary: '英语词汇',
  listening: '英语听力',
  politics: '政治客观题',
  critical: '危重症',
};

const politicsKinds = {
  all: '全部题型',
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
};

const itemsOfKind = (items, kind) =>
  kind === 'all' ? items : items.filter(item => item.type === politicsKinds[kind]);

const examRows = [
  ['11 月 28 日', '09:00–11:00', '英语', [
    ['词汇速记', '#sprint?area=vocabulary'], ['听力专项', '#sprint?area=listening'], ['课外阅读', '#exam?course=05&type=reading']
  ]],
  ['11 月 29 日', '09:00–11:00', '医学统计学', [
    ['公式速查', '#sprint?area=statistics'], ['混合练考', '#exam?course=01']
  ]],
  ['11 月 29 日', '14:30–16:30', '政治 · 新思想', [
    ['客观题练习', '#sprint?area=politics'], ['政治错题', '#sprint?area=politics&mode=wrong']
  ]],
  ['12 月 27 日', '09:00–11:00', '临床思维与人际沟通', [
    ['知识卡', '#subject?id=11'], ['案例练习', '#exam?course=11']
  ]],
];

export function sprintHome() {
  return `<section class="sprint-home" aria-label="考试安排与复习入口">
    <div class="sprint-intro"><p class="sprint-kicker">2026 年期末复习</p><h1>期末自习室</h1>
    <p>按考期选科目。先做一组，答完再回看错题。</p></div>
    <div class="sprint-exams">${examRows.map(([date,time,subject,links])=>
      `<article class="sprint-exam"><div class="sprint-date"><strong>${date}</strong><span>${time}</span></div>
      <div class="sprint-exam-main"><h2>${subject}</h2><div class="sprint-links">${links.map(([name,url])=>
        `<a href="${escape(url)}">${name}</a>`).join('')}</div></div></article>`).join('')}</div>
    <div class="sprint-later"><div><strong>危重症</strong><p>稍后复习 · 题库与摸底卷</p></div><a class="button small" href="#sprint?area=critical">查看题库</a></div>
  </section>`;
}

const vocab = [
  {title:'通用词义与搭配',words:[
    ['distinguish','辨别，区分','distinguish between A and B'],['transient','短暂的，暂时的','transient symptoms'],
    ['intermittent','间歇的，时有时无的','intermittent pain'],['regimen','计划，方案','a treatment regimen'],
    ['exacerbate','使加重，使恶化','exacerbate a problem'],['exacerbation','加重，恶化（名词）','an exacerbation of symptoms'],
    ['address','处理，设法解决','address a problem'],['alleviate','缓解，减轻','alleviate discomfort'],
    ['imperative','至关重要的，迫切需要的','It is imperative to …'],['replenish','补充，重新备足','replenish supplies'],
    ['hamper','妨碍，阻碍','hamper progress'],['dearth','缺乏，不足','a dearth of evidence'],
    ['innocuous','无害的','an innocuous remark'],['thereof','其，关于前述事物的','the details thereof'],
  ]},
  {title:'眼科与医学阅读',words:[
    ['retina','视网膜',''],['pupil','瞳孔（眼科语境）',''],['iris','虹膜',''],['glaucoma','青光眼',''],
    ['cataract','白内障',''],['opacity','混浊，不透明',''],['macular degeneration','黄斑变性',''],
    ['retinopathy','视网膜病变',''],['ophthalmology','眼科学',''],['bifocals','双焦眼镜',''],
    ['intraocular','眼内的',''],['disorientation','定向障碍',''],['irreversible','不可逆的',''],
    ['implicate','暗示某事有关，牵涉','implicate a factor'],
  ]},
  {title:'研究与课文易混词',words:[
    ['adverse','不良的，不利的','adverse effects'],['placebo','安慰剂','a placebo group'],
    ['withhold','扣留，暂不给予或发布','withhold a report'],['validate','验证，证实','validate the findings'],
    ['efficacious','有效的',''],['suboptimal','不够理想的',''],['empirical','基于经验或观察的','empirical evidence'],
    ['impediment','障碍，阻碍（名词）','an impediment to progress'],['elicit','引出，诱出','elicit a response'],
    ['threshold','阈值，门槛',''],['intractable','顽固的，难治的',''],['palliative care','姑息治疗，缓和照护',''],
    ['insofar as','就……而言，在……范围内',''],['encompass','包含，涵盖',''],
  ]},
];

const stats = [
  ['标准误与置信区间', '均数 SE = s ÷ √n。大样本估计总体率，SE = √[p × (1 − p) ÷ n]。', '区间 = 估计值 ± 临界值 × SE。配对均数差用配对数和差值标准差。'],
  ['三类 t 检验', '单样本以样本均数减假设值。配对先算每对的差值。独立两组比较两个样本均数。', '单样本和配对的自由度是 n − 1。独立两组方差齐时，合并方差检验自由度是 n₁ + n₂ − 2。'],
  ['方差分析与两两比较', '完全随机设计用组间均方除以组内均方。随机区组设计比较处理效应用处理均方除以误差均方。', '总体显著说明总体均数并非全相等。Bonferroni 法用原始 P 值与 0.05 ÷ 比较次数比较。'],
  ['卡方与 McNemar', '独立列联表的理论频数 = 行合计 × 列合计 ÷ 总人数。配对二分类比较阳性率，取两个不一致格。', '题干给定的校正规则下，McNemar 校正统计量 = (|b − c| − 1)² ÷ (b + c)。'],
  ['秩检验', '两独立组的秩和检验合并编秩。配对符号秩先去零差，再按绝对差值编秩。', '三组及以上独立样本用 Kruskal–Wallis。同一批对象的多次测量用 Friedman，在每个对象内部编秩。'],
  ['回归与二项、泊松分布', '回归先算预测值，残差 = 实测值 − 预测值。预测均值区间用预测均值的 SE。', '固定次数的独立等概率试验用二项分布。稳定、独立到达的计数可用 Poisson。至少一次 = 1 − P(0)。'],
];

function route(area, group, mode, kind = 'all') {
  const params = new URLSearchParams({area});
  if (group) params.set('group',group);
  if (mode && mode!=='all') params.set('mode',mode);
  if (area === 'politics' && kind !== 'all') params.set('kind',kind);
  return `sprint?${params}`;
}

function politicsFilters({group, mode, kind, items}) {
  const counts = Object.fromEntries(
    Object.keys(politicsKinds).map(key => [key, itemsOfKind(items,key).length])
  );
  return `<nav class="sprint-links sprint-type-filters" aria-label="按政治题型筛选">
    ${Object.entries(politicsKinds).map(([key, label]) => `
      <a href="#${route('politics',group,mode,key)}" ${kind===key?'aria-current="page"':''}>${label} <span>${counts[key]}</span></a>`).join('')}
  </nav>`;
}

function heading(title, subtitle) {
  return `<a class="back" href="#home">返回期末自习室</a><div class="page-heading sprint-heading"><h1>${title}</h1><p>${subtitle}</p></div>`;
}

function vocabulary() {
  return heading('英语词汇','先回忆词义，再展开核对。原词表按栏放大查看。')+
    `<div class="sprint-links"><a href="#english?tab=vocab">六单元原题填空</a><a href="#exam?course=05&type=single_choice">词汇选择题</a><a href="#sprint?area=listening">听力专项</a></div>
    <div class="sprint-vocab">${vocab.map(group=>`<section class="panel"><h2>${group.title}</h2>
      <div class="sprint-words">${group.words.map(([word,meaning,example])=>`<details><summary lang="en">${escape(word)}</summary><p>${escape(meaning)}${example?` <span lang="en">${escape(example)}</span>`:''}</p></details>`).join('')}</div></section>`).join('')}</div>
    <section class="panel sprint-original"><h2>查看完整词表</h2>${['左栏','中栏','右栏'].map((name,i)=>`<details><summary>${name}</summary><a href="./sprint-assets/vocabulary-${i+1}.webp" target="_blank" rel="noopener" aria-label="打开${name}高清图"><img loading="lazy" src="./sprint-assets/vocabulary-${i+1}.webp" alt="英语单选单词原词表${name}"></a></details>`).join('')}</section>`;
}

function statistics() {
  return heading('统计公式速查','计算前先确定是均数、率还是等级资料，然后看是独立、配对还是区组设计。')+
    `<div class="sprint-links"><a href="#exam?course=01">开始统计练考</a><a href="#subject?id=01&tab=coverage">按章节复习</a></div>
    <div class="sprint-vocab">${stats.map(([title,first,second])=>`<section class="panel"><h2>${title}</h2><p>${first}</p><p>${second}</p></section>`).join('')}</div>`;
}

export function sameAnswer(actual, expected) {
  return expected.length>0 && [...new Set(actual)].sort().join('') === [...expected].sort().join('');
}

function questionHtml(item,record,draft) {
  const scored = record?.answer || [];
  const checked = record ? scored : draft || [];
  const result = record ? (!item.answer.length ? '已核对' : record.correct ? '答对' : '待订正') : '';
  const type = item.multiple?'checkbox':'radio';
  return `<article class="panel sprint-question" id="${escape(item.id)}"><fieldset ${record?'disabled':''}>
    <legend><span class="sprint-q-type">第 ${item.number} 题${item.type?` · ${escape(item.type)}`:''}</span>
    <span class="sprint-stem">${escape(item.stem)}</span></legend>
    ${item.options.map(option=>`<label class="sprint-option"><input type="${type}" name="${escape(item.id)}" data-sprint-id="${escape(item.id)}" value="${escape(option.key)}" ${checked.includes(option.key)?'checked':''}>
    <span><strong>${escape(option.key)}.</strong> ${escape(option.text)}</span></label>`).join('')}
    </fieldset>${record?`<div class="sprint-feedback ${record.correct?'is-correct':'is-wrong'}"><strong>${result}</strong>
    ${item.answer.length?` <span>参考答案 ${escape(item.answer.join('、'))}</span>`:` <span>原资料标注 ${escape(item.sourceAnswer || '待核对')}，本题不计分。</span>`}
    <small>${escape(item.source)}${item.pages.length?` · 第 ${item.pages.join('、')} 页`:''}</small>
    <button class="button small" data-action="sprint-redo" data-item="${escape(item.id)}">重做这题</button></div>`:''}</article>`;
}

export function createSprintController({state,persist,go,render,toast}) {
  state.sprint ??= {records:{}, drafts:{}};
  const records = state.sprint.records;
  const drafts = state.sprint.drafts;
  const packs = {};
  let context;
  let viewId = 0;

  async function load(area) {
    if (!packs[area]) {
      const response=await fetch(`./data/sprint-${area}.json?v=final21a`);
      if (!response.ok) throw Error('Unable to load sprint material');
      packs[area]=await response.json();
    }
    return packs[area];
  }

  function list(area, groups, mode, kind) {
    const lead = area==='politics' ? '导论至第十章。卷面客观题共 80 分：单选 40 题、多选 20 题、判断 20 题。'
      : area==='listening' ? '8 组共 40 题。边听边选，交卷后显示参考答案。'
      : '577 道单选、67 道多选，另有 50 道摸底题。';
    const tabs = `<div class="sprint-links"><a href="#${route(area,null,'all',kind)}" ${mode==='all'?'aria-current="page"':''}>全部题组</a><a href="#${route(area,null,'wrong',kind)}" ${mode==='wrong'?'aria-current="page"':''}>待订正</a></div>`;
    const allItems = groups.flatMap(g=>g.items);
    const filters = area === 'politics' ? politicsFilters({mode,kind,items:allItems}) : '';
    const summary = itemsOfKind(allItems,kind);
    const completed = summary.filter(q=>records[q.id]).length;
    const groupCards = groups.map(group=>{
      const items = itemsOfKind(group.items,kind);
      const seen=items.filter(q=>records[q.id]).length;
      const wrong=items.filter(q=>records[q.id]?.correct===false).length;
      if(!items.length || (mode==='wrong'&&!wrong))return '';
      return `<a class="sprint-group" href="#${route(area,group.id,mode,kind)}"><div><h2>${escape(group.title)}</h2><p>${items.length} 题 · 已核对 ${seen}${wrong?` · 待订正 ${wrong}`:''}</p></div><span>${area==='listening'?(group.track?'有配套音频':'待配音频'):mode==='wrong'?'订正':'开始'}</span></a>`;
    }).join('');
    return heading(tracks[area],lead)+tabs+filters+
      `<section class="sprint-groups" aria-label="题组列表"><p class="sprint-count">已核对 ${completed} / ${summary.length} 题</p>${groupCards || '<p class="panel">目前没有待订正的题。</p>'}</section>`;
  }

  async function view(params) {
    const id = ++viewId;
    context = null;
    const area=params.get('area') || 'politics';
    if(area==='vocabulary')return vocabulary();
    if(area==='statistics')return statistics();
    if(!Object.hasOwn(tracks,area))return heading('考前练习','从首页选择科目。');
    const mode=params.get('mode')==='wrong'?'wrong':'all';
    const requestedKind = params.get('kind');
    const kind = area === 'politics' && Object.hasOwn(politicsKinds,requestedKind)
      ? requestedKind : 'all';
    const groups=await load(area);
    if(id!==viewId)return null;
    const group=groups.find(g=>g.id===params.get('group'));
    if(!group)return list(area,groups,mode,kind);
    const allItems = itemsOfKind(group.items,kind);
    const items=allItems.filter(q=>mode==='all'||records[q.id]?.correct===false||
      (area!=='politics'&&drafts[q.id]?.length));
    context = {area,group,items,mode,kind};
    const chapters=area==='politics'&&mode==='wrong'
      ? groups.filter(chapter=>chapter===group||itemsOfKind(chapter.items,kind).some(q=>records[q.id]?.correct===false))
      : groups;
    const adjacent=chapters.indexOf(group);
    const previous=chapters[adjacent-1], next=chapters[adjacent+1];
    const correct=allItems.filter(q=>records[q.id]?.correct===true).length;
    const done=allItems.filter(q=>records[q.id]).length;
    const filters = area === 'politics'
      ? politicsFilters({group:group.id,mode,kind,items:group.items}) : '';
    const audio=group.track?`<div class="panel sprint-player"><audio controls preload="none" src="./audio/english-2026/${escape(group.track)}" aria-label="${escape(group.title)}录音"></audio></div>`
      : group.mediaNote?`<p class="notice">${escape(group.mediaNote)}</p>`:'';
    return `<a class="back" href="#${route(area,null,mode,kind)}">返回${tracks[area]}</a>
    <div class="page-heading sprint-heading"><p class="sprint-kicker">${tracks[area]}</p><h1>${escape(group.title)}</h1><p>已核对 ${done} / ${allItems.length} 题 · 答对 ${correct} 题</p></div>
    ${area==='critical'?'<p class="notice">按原练习资料的参考答案核对，临床处置以课程要求及现行规范为准。</p>':''}${audio}
    ${mode==='wrong'?'<p class="notice">点击题目下方的「重做这题」后重新作答。</p>':''}
    ${filters}
    <div class="sprint-questions">${items.map(item=>questionHtml(item,records[item.id],drafts[item.id])).join('') || '<p class="panel">这组没有待订正题。</p>'}</div>
    <div class="sprint-submit"><button class="button primary" data-action="sprint-submit" ${area==='politics'&&items.every(item=>records[item.id])?'disabled':''}>核对本组已答题</button><a class="button" href="#${route(area,null,mode,kind)}">${area==='politics'?'返回题组列表':'查看全部题组'}</a></div>
    <div class="sprint-links sprint-group-nav">${previous?`<a href="#${route(area,previous.id,mode,kind)}">上一组</a>`:''}${next?`<a href="#${route(area,next.id,mode,kind)}">下一组</a>`:''}</div>`;
  }

  function change(input) {
    const id=input.dataset.sprintId;
    if (!id || !context?.items.some(q=>q.id===id) || records[id])return;
    const active = drafts[id] || [];
    drafts[id]=input.type==='radio'?[input.value]
      : input.checked?[...new Set([...active,input.value])]:active.filter(key=>key!==input.value);
    persist();
  }

  function click(el) {
    if(!context)return;
    if(el.dataset.action==='sprint-redo') {
      const id=el.dataset.item;
      if(!context.items.some(q=>q.id===id))return;
      drafts[id]=[];
      delete records[id];
      if (context.mode==='wrong') go(route(context.area,context.group.id,'all',context.kind));
      else render();
    }
    if(el.dataset.action==='sprint-submit') {
      const submitted=context.items.filter(q=>!records[q.id] && drafts[q.id]?.length);
      if(!submitted.length){toast('先作答，再核对');return;}
      for(const item of submitted){
        records[item.id]={answer:drafts[item.id],correct:item.answer.length?sameAnswer(drafts[item.id],item.answer):null};
        delete drafts[item.id];
      }
      persist();
      render();
      toast(`已核对 ${submitted.length} 题`);
    }
  }

  return {view,change,click};
}
