import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

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

test('review rollout only adds metadata: original IDs, questions, explanations and sources are unchanged',()=>{
 const original=structuredClone(data);
 for(const answer of original.answers){delete answer.verification;delete answer.correctOption;}
 const digest=createHash('sha256').update(JSON.stringify(original)).digest('hex');
 // Fingerprint of answers.json at a0dd859, before the review rollout.
 // An intentional later content revision should explicitly review/update this fixture.
 assert.equal(digest,'d6b7301f9372784ccabbc655cf1276f49cef3e637faafd4c85711c91f603a834');
 assert.equal(answers.size,18);
});

test('all checked answers use explicit letters matching the manually verified option text',()=>{
 for(const [id,[letter,text]] of Object.entries(expectedOptions)){
  const answer=answers.get(id);
  assert.equal(answer.verification.status,'checked',id);
  assert.equal(answer.correctOption,letter,id);
  assert.equal(answer.question.options.find(option=>option.label===letter)?.text,text,id);
  assert.match(answer.verification.note,/参考解析.*并非官方标准答案/,id);
 }
 assert.equal(data.answers.filter(answer=>answer.verification.status==='checked').length,15);
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
  '原卷统计材料页缺失；现有补充来源不能替代原材料。暂不自动判分，不计入正确率。',
  '原材料照片中的关键读数尚待清晰原题核实。暂不自动判分，不计入正确率。',
  '现有参考解析之间存在争议，未核验到命题机关公开标准答案。暂不自动判分，不计入正确率。'
 ]);
 for(const answer of data.answers){
  assert.ok(allowedNotes.has(answer.verification.note),answer.id);
  assert.doesNotMatch(answer.verification.note,/[A-H]/,answer.id);
 }
});
