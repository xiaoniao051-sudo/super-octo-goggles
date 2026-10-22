import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {getVerification,gradeAnswer,getReviewSummary} from './review.js';

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
const addedIds=[addedId,growthId];
const originalIds=[...Object.keys(expectedOptions),...Object.keys(unresolved)];

test('review rollout only adds metadata: original IDs, questions, explanations and sources are unchanged',()=>{
 const original=structuredClone(data);
 original.answers=original.answers.filter(answer=>!addedIds.includes(answer.id));
 original.updatedAt='2026-10-20';
 assert.equal(original.answers.length,18);
 assert.deepEqual(original.answers.map(answer=>answer.id).sort(),[...originalIds].sort());
 for(const answer of original.answers){delete answer.verification;delete answer.correctOption;}
 const digest=createHash('sha256').update(JSON.stringify(original)).digest('hex');
 // Fingerprint of answers.json at a0dd859, before the review rollout.
 // Exclude only the explicitly added questions and restore the original collection date;
 // never refresh the old-content fingerprint.
 assert.equal(digest,'d6b7301f9372784ccabbc655cf1276f49cef3e637faafd4c85711c91f603a834');
 assert.equal(data.answers.length,20);
 assert.equal(answers.size,20,'IDs remain unique');
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
 assert.equal(data.answers[0].id,growthId,'newly added question stays first');
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
