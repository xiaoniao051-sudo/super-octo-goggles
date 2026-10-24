import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {getVerification,gradeAnswer,getReviewSummary} from './review.js';
import {adaptSourceQuestion,submissionResult} from './verbal-practice-model.js';
import {loadStudy,saveAnswerNote,recordReviewAttempt} from './storage.js';

const data=JSON.parse(readFileSync(new URL('./answers.json',import.meta.url),'utf8'));
const answers=new Map(data.answers.map(answer=>[answer.id,answer]));
const expectedOptions={
 'fenbi-2027-s39-enforcement-063':['A','而在于如今开始能够生成语境'],
 'fenbi-2027-s39-enforcement-038':['C','固本浚源'],
 'fenbi-2027-s39-enforcement-052':['D','非遗音乐创新坚持艺术本真方能永葆生机'],
 'verbal-marriage-customs-sentence':['D','婚俗之“俗”，乃传统习俗、公序良俗之意，绝无半点庸俗、低俗的味道'],
 'gk-2023-enforcement-037':['D','慢条斯理　此起彼伏　泡沫化'],
 'gk-2023-enforcement-039':['B','力不从心　风吹草动　精细'],
 'gk-2023-enforcement-066':['D','1/7'],
 'gk-2023-enforcement-067':['C','10001～20000种之间'],
 'gk-2023-enforcement-068':['A','不到44千米/小时'],
 'gk-2023-enforcement-097':['C','选购家电∶上门安装∶维修保养'],
 'gk-2023-enforcement-003':['C','分配制度是促进共同富裕的基础性制度'],
 'gk-2023-enforcement-004':['A','全社会研发经费支出跃居世界第一'],
 'gk-2023-enforcement-005':['D','水土保持区以内蒙古高原南缘、宁夏中部等为主'],
 'gk-2023-enforcement-006':['D','有价证券的债务人可以请求债权人支付相应对价'],
 'gk-2023-enforcement-007':['B','国家构建以高质量绿色发展为导向的新型农业补贴政策体系']
};
const unresolved={
 'fenbi-2027-s39-enforcement-125':'incomplete',
 'fenbi-2027-s39-enforcement-126':'pending',
 'gk-2023-enforcement-059':'disputed'
};
const addedId='gk-2023-enforcement-024';
const growthId='ziliao-feisheng-200-part2-007';
const climateId='verbal-exercise27-001';
const enforcement2022Ids=["verbal-a5168b49d026064bf459a94f", "verbal-5a0d1d1bcc4381dd16842247", "verbal-d91a592170c7c9825085c7c6", "verbal-468ec5de3b18fa4c3c62738b", "verbal-9a55730921f0aca3c203d635"];
const readingTwoIds=['verbal-privacy-convenience-006','cq-2022-selected-043'];
const addedIds=[addedId,growthId,climateId,...enforcement2022Ids,...readingTwoIds];
const originalIds=[...Object.keys(expectedOptions),...Object.keys(unresolved)];

test('five 2022 questions reuse indexed identities and explicitly map this edition to B/D/A/A/B',()=>{
 const bank=JSON.parse(readFileSync(new URL('./verbal-bank.json',import.meta.url),'utf8'));
 const expected=[
  ['31','B',['周期性　高效','间歇性　平稳','地域性　持续','阶段性　弹性'],11],
  ['32','D',['异军突起　推陈出新','横空出世　一举两得','粉墨登场　扬长避短','应运而生　另辟蹊径'],12],
  ['34','A',['不期而至　克敌制胜','有机可乘　攻无不克','纷至沓来　所向披靡','不请自来　攻坚克难'],14],
  ['36','A',['照搬　自立门户　屈指可数','保持　另起炉灶　凤毛麟角','沿袭　独当一面　差强人意','复制　革故鼎新　寥寥无几'],16],
  ['40','B',['方向　受制　大开眼界','视角　拘泥　流连忘返','境界　局限　身临其境','途径　止步　叹为观止'],20]
 ];
 for(const [i,[number,key,options,moduleNumber]] of expected.entries()){
  const q=answers.get(enforcement2022Ids[i]),item=bank.items.find(x=>x.id===q.id);
  assert.equal(q.paper,'2022年国考行政执法卷');assert.equal(q.number,number);
  assert.deepEqual(q.question.options.map(o=>o.label),['A','B','C','D']);
  assert.deepEqual(q.question.options.map(o=>o.text),options);assert.equal(q.correctOption,key);
  assert.equal(q.addedAt,'2026-10-23');assert.equal(q.reviewedAt,'2026-10-23');
  assert(q.question.stem.length>80);assert(q.question.prompt);assert(q.sections.length>=5);
  assert(q.answer.includes(options['ABCD'.indexOf(key)].replaceAll('　','—')));
  assert.equal(bank.explained.filter(e=>e.answerId===q.id).length,1);
  assert(item.occurrences.some(o=>o.paperId==='guokao-2022-enforcement'&&o.moduleNumber===moduleNumber));
  for(const letter of 'ABCD')assert.equal(gradeAnswer(q,letter),letter===key);
  assert.doesNotMatch(JSON.stringify(q),/你选了|你当时|你的选项|你的思考/);
 }
 assert.deepEqual(data.answers.filter(q=>enforcement2022Ids.includes(q.id)).map(q=>q.id),enforcement2022Ids);
});

test('source edition and checked edition share a note key without mixing answer letters or grading evidence',()=>{
 const q=answers.get(enforcement2022Ids[0]),content=new Map();
 const storage={getItem:k=>content.get(k)??null,setItem:(k,v)=>content.set(k,v)};
 // The existing runtime edition puts the same correct words in C, not B.
 const words=['地域性　持续','阶段性　弹性','间歇性　平稳','周期性　高效'];
 const parsed={qid:'4637390',stem:[{type:'text',text:q.question.stem}],options:words.map((text,i)=>({label:'ABCD'[i],segments:[{type:'text',text}]})),referenceAnswer:{value:'C'}};
 const runtime=adaptSourceQuestion(parsed,{id:q.id,part:'逻辑填空',subtype:'词语辨析'},{moduleNumber:11},{id:'guokao-2022-enforcement',title:'运行时回忆版',url:'https://example.com',exam:'guokao',year:2022});
 assert.equal(runtime.id,q.id);assert.equal(submissionResult(runtime,'C').kind,'reference-match');
 assert.equal(submissionResult(runtime,'C').correct,null);assert.equal(gradeAnswer(q,'C'),false);
 saveAnswerNote(storage,runtime.id,{note:'既有笔记'});
 recordReviewAttempt(storage,runtime,{selectedOption:'C',attemptId:'attempt-source-edition-test'});
 recordReviewAttempt(storage,q,{selectedOption:'B',attemptId:'attempt-checked-edition-test'});
 const study=loadStudy(storage);
 assert.deepEqual(Object.keys(study.answerNotes),[q.id]);assert.equal(study.answerNotes[q.id].note,'既有笔记');
 assert.equal(study.reviewAttempts[q.id].length,2);
 assert.deepEqual(study.reviewAttempts[q.id].map(a=>a.correct),[null,true]);
 assert.equal(getReviewSummary([q],study).gradedCount,1);
});

test('original IDs, questions and sources stay fixed; only two approved editorial revisions are excluded',()=>{
 const original=structuredClone(data);
 original.answers=original.answers.filter(answer=>!addedIds.includes(answer.id));
 original.updatedAt='2026-10-20';
 assert.equal(original.answers.length,18);
 assert.deepEqual(original.answers.map(answer=>answer.id).sort(),[...originalIds].sort());
 for(const answer of original.answers){
  delete answer.verification;delete answer.correctOption;
  if(['gk-2023-enforcement-037','gk-2023-enforcement-039'].includes(answer.id))
   for(const field of ['title','summary','answer','sections','reviewedAt'])delete answer[field];
 }
 const digest=createHash('sha256').update(JSON.stringify(original)).digest('hex');
 // Baseline 6f3a421: exclude only the approved 37/39 editorial fields.
 // Their original questions, options, sources and addedAt remain fingerprinted,
 // as does every other old record; unrelated changes must still fail.
 assert.equal(digest,'7774c63f5425953c0a4caa825a810d9a8b28b590b525930f3fd7db0c80094dc8');
 assert.equal(data.answers.length,28);
 assert.equal(answers.size,28,'IDs remain unique');
 assert.deepEqual([...answers.keys()].sort(),[...originalIds,...addedIds].sort());
});

test('all checked answers use explicit letters matching the manually verified option text',()=>{
 for(const [id,[letter,text]] of Object.entries(expectedOptions)){
  const answer=answers.get(id);
  assert.equal(answer.verification.status,'checked',id);
  assert.equal(answer.correctOption,letter,id);
  assert.equal(answer.question.options.find(option=>option.label===letter)?.text,text,id);
  assert.match(answer.verification.note,/参考解析.*并非官方标准答案/,id);
 }
 assert.deepEqual(data.answers.filter(answer=>answer.verification.status==='checked').map(answer=>answer.id).sort(),[...Object.keys(expectedOptions),...addedIds].sort());
});

test('2023 enforcement question 24 keeps A–D option order and grades only B as correct',()=>{
 const answer=answers.get(addedId);
 assert.ok(answer,'new stable ID is present');
 assert.equal(answer.number,'24');
 assert.equal(answer.paper,'2023年国考行政执法卷');
 assert.deepEqual(answer.question.options.map(option=>[option.label,...option.text.trim().split(/\s+/)]),[
  ['A','突破','扭转'],
  ['B','摒弃','校正'],
  ['C','摆脱','规划'],
  ['D','忽略','调整']
 ]);
 assert.equal(answer.verification.status,'checked');
 assert.equal(answer.correctOption,'B');
 assert.match(answer.verification.note,/参考解析.*并非官方标准答案/);
 assert.equal(getVerification(answer).canGrade,true);
 assert.equal(gradeAnswer(answer,'B'),true);
 for(const option of ['A','C','D'])assert.equal(gradeAnswer(answer,option),false,option);
 assert.equal(gradeAnswer(answer,'E'),null);
 const summary=getReviewSummary(data.answers,{});
 assert.deepEqual(summary.newItems.map(item=>item.id).sort(),[...Object.keys(expectedOptions),...addedIds].sort());
 assert.deepEqual(summary.paused.map(item=>item.id).sort(),Object.keys(unresolved).sort());
 assert.equal(summary.due.length,0);
});

test('FIC question compares both five-year totals and only China crosses the three-times threshold',()=>{
 const answer=answers.get(growthId);
 assert.ok(answer,'FIC question has a separate stable ID');
 assert.ok(data.answers.findIndex(item=>item.id===growthId)>data.answers.findIndex(item=>item.id===climateId),'FIC follows the newly added climate question');
 assert.equal(answer.addedAt,'2026-10-22');
 assert.equal(answer.number,'7');
 assert.deepEqual(answer.question.options.map(option=>[option.label,option.text.trim()]),[
  ['A','中国'],['B','日本'],['C','欧洲'],['D','美国']
 ]);
 assert.equal(answer.verification.status,'checked');
 assert.equal(answer.correctOption,'A');
 assert.equal(getVerification(answer).canGrade,true);
 assert.equal(gradeAnswer(answer,'A'),true);
 for(const option of ['B','C','D'])assert.equal(gradeAnswer(answer,option),false,option);

 const expected={
  '中国':{before:[9,10,20,25,40],after:[50,112,116,127,120],totals:[104,525]},
  '日本':{before:[7,8,10,8,11],after:[10,17,12,13,12],totals:[44,64]},
  '欧洲':{before:[31,40,44,42,63],after:[55,61,70,77,72],totals:[220,335]},
  '美国':{before:[47,75,77,89,104],after:[134,138,178,159,151],totals:[392,760]}
 };
 const growth={};
 for(const [region,evidence]of Object.entries(expected)){
  const rows=[...answer.question.stem.matchAll(new RegExp(region+'：[ \\t]*([^\\r\\n]+)','g'))]
   .map(match=>match[1].trim().split('、').map(value=>{
    assert.match(value.trim(),/^\d+$/,region+' contains only integer counts');
    return Number(value.trim());
   }));
  assert.equal(rows.length,2,region+' occurs once in each five-year period');
  assert.deepEqual(rows.map(row=>row.length),[5,5],region+' has five annual values per period');
  assert.deepEqual(rows,[evidence.before,evidence.after],region+' matches the supplied table');
  const [before,after]=rows,totals=rows.map(row=>row.reduce((sum,value)=>sum+value,0));
  assert.deepEqual(totals,evidence.totals,region+' five-year sums');
  const margins=after.map((value,index)=>value-3*before[index]);
  if(region==='中国'){
   assert.ok(margins.every(value=>value>=0)&&margins.some(value=>value>0),'China is at least 3x in every pair and strictly greater in some');
   assert.ok(totals[1]>3*totals[0],'China total is strictly above 3x');
  }else{
   assert.ok(margins.every(value=>value<0),region+' is strictly below 3x in every pair');
   assert.ok(totals[1]<3*totals[0],region+' total is strictly below 3x');
  }
  growth[region]=(totals[1]-totals[0])/totals[0];
 }
 assert.ok(growth['中国']>2);
 for(const region of ['日本','欧洲','美国'])assert.ok(growth[region]<2&&growth['中国']>growth[region],region+' has lower five-year growth');
 const originalSeven=answers.get('gk-2023-enforcement-007');
 assert.equal(originalSeven.correctOption,'B','the distinct 2023 enforcement question 7 is unchanged');
 assert.equal(gradeAnswer(originalSeven,'B'),true);
});

test('exercise 27 keeps its unidentified provenance, full option order and reference answer C',()=>{
 const answer=answers.get(climateId);
 assert.ok(answer,'climate question has a separate stable ID');
 assert.equal(answer.paper,'练习题27（书名、版次未显示）');
 assert.equal(answer.number,'1');
 assert.equal(answer.addedAt,'2026-10-22');
 assert.equal(data.answers.filter(a=>![...enforcement2022Ids,...readingTwoIds].includes(a.id))[0].id,climateId,'older additions retain their order');
 assert.deepEqual(answer.question.options.map(option=>[option.label,option.text.trim()]),[
  ['A','回顾历史上的气候变迁过程'],
  ['B','强调气候对粮食生产的意义'],
  ['C','揭示气候变化对人类社会的影响'],
  ['D','说明气候是影响王朝兴衰的因素']
 ]);
 assert.equal(answer.verification.status,'checked');
 assert.equal(answer.correctOption,'C');
 assert.equal(getVerification(answer).canGrade,true);
 assert.equal(gradeAnswer(answer,'C'),true);
 for(const option of ['A','B','D'])assert.equal(gradeAnswer(answer,option),false,option);
 assert.equal(gradeAnswer(answer,'E'),null);
 const provenance=[answer.sourceVersion,answer.question.versionNote].join('\n');
 assert.match(provenance,/用户.*(?:图片|照片)/,'source is the supplied image');
 assert.match(provenance,/(?:未|不)[^。；\n]*真题/,'unknown exam provenance is not promoted to an identified past exam');
 assert.doesNotMatch(answer.paper,/国考|省考|\d{4}年/);

 const sameDay=data.answers.filter(item=>item.addedAt==='2026-10-22').map(item=>item.id);
 assert.deepEqual(sameDay,[climateId,growthId],'same-day additions retain their insertion order');
 const sorted=[...data.answers].sort((a,b)=>(b.addedAt||'').localeCompare(a.addedAt||''));
 assert.deepEqual(sorted.filter(a=>![...enforcement2022Ids,...readingTwoIds].includes(a.id)).slice(0,2).map(item=>item.id),[climateId,growthId],'stable date sorting keeps the newest addition before FIC');
 assert.deepEqual(getReviewSummary(data.answers,{}).newItems.filter(a=>![...enforcement2022Ids,...readingTwoIds].includes(a.id)).slice(0,2).map(item=>item.id),[climateId,growthId],'the new-question queue preserves the same order');
});

test('missing material, ambiguous readings and disputed answers have no grading key',()=>{
 for(const [id,status] of Object.entries(unresolved)){
  const answer=answers.get(id);
  assert.equal(answer.verification.status,status,id);
  assert.equal(Object.hasOwn(answer,'correctOption'),false,id);
  assert.match(answer.verification.note,/暂不自动判分，不计入正确率/,id);
 }
 assert.match(answers.get('fenbi-2027-s39-enforcement-125').question.versionNote,/材料前页缺失/);
 assert.match(answers.get('fenbi-2027-s39-enforcement-126').answer,/关键读数待核/);
 assert.match(answers.get('gk-2023-enforcement-059').answer,/保留A\/D争议/);
});

test('pre-answer verification notices are neutral and contain no answer letters or solution hints',()=>{
 const allowedNotes=new Set([
  "题面与选项按图片核对，已完成本站独立参考解答及原文语境核对；考试来源、年份和原卷号未确认，未取得官方或机构答案。",
  "题面与本页选项顺序已按图片及公开整理资料核对，采用本站参考解析进行复测，并非官方标准答案；图片号与公开整理卷题号分别说明。",

  '按现有题面、本页选项顺序及已记录的核对依据整理，复测使用本站参考解析，并非官方标准答案。',
  '已按公开整理资料核对题面及本页选项顺序，采用本站参考解析进行复测；不同资料顺序有差异，并非官方标准答案。',
  '原卷统计材料页缺失；现有补充来源不能替代原材料。暂不自动判分，不计入正确率。',
  '原材料照片中的关键读数尚待清晰原题核实。暂不自动判分，不计入正确率。',
  '现有参考解析之间存在争议，未核验到命题机关公开标准答案。暂不自动判分，不计入正确率。'
 ]);
 for(const answer of data.answers){
  assert.ok(allowedNotes.has(answer.verification.note),answer.id);
  assert.doesNotMatch(answer.verification.note,/[A-H]/,answer.id);
 }
});


test('uploaded reading questions preserve numbering, negation, all choices and independent grading',()=>{
 const privacy=answers.get(readingTwoIds[0]),service=answers.get(readingTwoIds[1]);
 assert.equal(privacy.number,'6');assert.equal(service.number,'16');
 assert.equal(privacy.question.prompt,'这段文字主要表达的是：');
 assert.equal(service.question.prompt,'这段文字没有提到的是：');
 assert.match(privacy.question.versionNote,/年份.*未显示/);
 assert.match(service.question.versionNote,/2022年重庆选调第43题/);
 assert.deepEqual(service.question.options.map(x=>x.text),['我国社会保障体系逐步完善','我国教育公平质量显著提升','我国公共服务尚需均衡发展','我国公共服务能力需要提升']);
 assert.deepEqual(privacy.question.options.map(x=>x.text),['制定保护隐私的相关法规是当务之急','公众个人隐私和便捷性相关联','便捷性必须以隐私交换为条件','大数据时代更应保护公众隐私']);
 for(const q of [privacy,service]){
  assert.deepEqual(q.question.options.map(x=>x.label),['A','B','C','D']);
  assert.equal(q.correctOption,'D');assert.ok(q.answer.includes(q.question.options[3].text));
  for(const letter of 'ABCD')assert.equal(gradeAnswer(q,letter),letter==='D');
  assert.equal(q.addedAt,'2026-10-24');assert.equal(q.reviewedAt,'2026-10-24');
  assert(q.sections.length>=6);assert(q.sources.length>=1);
 }
 assert.match(privacy.answer,/本站参考答案/);assert.match(privacy.answer,/未查得本题官方答案或可核实的机构答案页/);
 assert.match(service.question.stem,/13\.5亿.*8000多万.*95\.2%/);
 const bank=JSON.parse(readFileSync(new URL('./verbal-bank.json',import.meta.url),'utf8'));
 for(const id of readingTwoIds)assert.equal(bank.explained.filter(x=>x.answerId===id&&x.exam==='supplement'&&x.part==='片段阅读').length,1);
 assert.equal(bank.explained.find(x=>x.answerId===privacy.id).year,null);
});
