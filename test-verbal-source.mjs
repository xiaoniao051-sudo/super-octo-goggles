import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVerbalSource,rawSourceUrl} from './verbal-source-parser.js';

const url='https://github.com/ERRRC/xingcezhenti/blob/278984401124db40da5163a31275b8deb9c282f4/03-言语理解与表达/测试.md';
// Only synthetic text is retained in regression fixtures.
const question=(n)=>`## 第 ${n} 题 <sub>qid ${n} · 片段阅读</sub>\n测试题${n}？\n- **A**. 甲\n- **B**. 乙 ✅\n- **C**. 丙\n- **D**. 丁\n**答案**：B\n**官方解析**\n不能返回的机构解析\n`;
const header=n=>`试卷: "测试"\n年份: "2023"\n题数: "${n}"\n`;
const options={sourceUrl:url,expectedTitle:'测试',expectedYear:2023,expectedCount:1,bindings:[{qid:'1',moduleNumber:1,materialGroupId:null}]};

test('fixed version, title, year, counts and occurrence identities must agree',()=>{
 const md=header(1)+question(1);
 assert.equal(parseVerbalSource(md,options).questions[0].sourceTextComplete,true);
 assert.throws(()=>rawSourceUrl(url.replace('278984401124db40da5163a31275b8deb9c282f4','main')));
 for(const patch of [{expectedTitle:'另一卷'},{expectedYear:2022},{expectedCount:2},{bindings:[{qid:'2',moduleNumber:1}]}])
  assert.throws(()=>parseVerbalSource(md,{...options,...patch}));
 assert.throws(()=>parseVerbalSource(header(2)+question(1),options));
 assert.throws(()=>parseVerbalSource(header(2)+question(1)+question(1),{...options,expectedCount:2,bindings:[options.bindings[0],options.bindings[0]]}));
});

test('empty options and conflicting answer marks cannot become playable',()=>{
 const md=header(1)+question(1);
 for(const bad of [md.replace('**C**. 丙','**C**. <p> </p>'),md.replace('**答案**：B','**答案**：D')])
  assert.equal(parseVerbalSource(bad,options).questions[0].sourceTextComplete,false);
 const result=parseVerbalSource(md,options);
 assert(!JSON.stringify(result).includes('不能返回的机构解析'));
 assert(!JSON.stringify(result.questions[0].options).includes('✅'));
 assert.equal(result.questions[0].eligibleForVerifiedStats,false);
});

test('explicit material groups bind only their questions; independent questions stay independent',()=>{
 const md=header(3)+'## 材料 1\n测试共享材料甲。\n'+question(1)+'## 材料 2\n测试共享材料乙。\n'+question(2)+question(3);
 const bindings=[1,2,3].map(n=>({qid:String(n),moduleNumber:n,materialGroupId:n<3?'test-passage-'+n:null}));
 const opts={...options,expectedCount:3,bindings};
 const result=parseVerbalSource(md,opts);
 assert.deepEqual(result.questions.map(q=>q.material?.number??null),[1,2,null]);
 assert(result.questions.every(q=>q.sourceTextComplete));
 assert(!JSON.stringify(result.questions[0].options).includes('测试共享材料乙'));
 assert.equal(parseVerbalSource(md,{...opts,bindings:bindings.map(b=>({...b,materialGroupId:null}))}).questions[0].sourceTextComplete,false);
 assert.equal(parseVerbalSource(md,{...opts,bindings:bindings.map((b,i)=>i===2?{qid:b.qid,moduleNumber:3}:b)}).questions[2].sourceTextComplete,false);
 assert.equal(parseVerbalSource(md.replace('测试共享材料甲。',''),opts).questions[0].sourceTextComplete,false);
 assert.throws(()=>parseVerbalSource(md.replace('## 材料 2','## 材料 1'),opts));
});
