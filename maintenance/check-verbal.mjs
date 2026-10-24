import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PARTS,validateBank,filterItems,numberLabel,toCsv,matchesQuery,safeUrl} from '../verbal-model.js';
const bank=validateBank(JSON.parse(fs.readFileSync(new URL('../verbal-bank.json',import.meta.url),'utf8')));
const papers=new Map(bank.papers.map(p=>[p.id,p]));
const answers=JSON.parse(fs.readFileSync(new URL('../answers.json',import.meta.url),'utf8')).answers;
assert.equal(new Set(bank.items.map(q=>q.id)).size,bank.items.length);
assert.equal(bank.stats.occurrences,bank.items.reduce((n,q)=>n+q.occurrences.length,0));
assert.equal(bank.stats.uniqueItems,bank.items.length);
for(const part of PARTS)assert.equal(bank.stats.parts[part],bank.items.filter(q=>q.part===part).length);
assert.equal(bank.stats.newIndependentSolutions,2);
assert.equal(bank.stats.newFullText,2);
const seenOccurrences=new Set();
for(const q of bank.items){assert(!Object.hasOwn(q,'stem'));assert(!Object.hasOwn(q,'answer'));assert(!Object.hasOwn(q,'options'));assert(q.occurrences.length);for(const o of q.occurrences){assert(!seenOccurrences.has(o.sourceOccurrenceId));seenOccurrences.add(o.sourceOccurrenceId);assert(papers.has(o.paperId));assert(o.moduleNumber>0);if(['guokao','fujian'].includes(papers.get(o.paperId).exam))assert.equal(o.originalNumber,null);}}
for(const a of bank.explained)assert(answers.some(q=>q.id===a.answerId),'Broken existing explanation ID');
const filtered=filterItems(bank.items,papers,{part:'逻辑填空',exam:'guokao',year:'2023',query:'第3题'});
for(const q of filtered)for(const o of q.matched){assert.equal(papers.get(o.paperId).year,2023);assert.equal(papers.get(o.paperId).exam,'guokao');assert([o.moduleNumber,o.originalNumber].includes(3));}
assert.equal(matchesQuery('37',{part:'逻辑填空',subtype:'选词填空'},{title:'2023试卷',year:2023},{moduleNumber:1,originalNumber:null,qid:'13782'}),false);
assert.equal(matchesQuery('qid:13782',{}, {},{moduleNumber:1,qid:'13782'}),true);
assert(numberLabel({moduleNumber:5,originalNumber:null}).includes('非原卷号'));
assert.equal(safeUrl('javascript:alert(1)'),null);
assert(toCsv(filtered,papers).startsWith('\ufeff'));
assert.equal(answers.find(a=>a.id==='gk-2023-enforcement-059').verification.status,'disputed');
assert.equal(answers.find(a=>a.id==='fenbi-2027-s39-enforcement-125').verification.status,'incomplete');
assert.equal(answers.find(a=>a.id==='fenbi-2027-s39-enforcement-126').verification.status,'pending');
console.log(JSON.stringify({result:'passed',papers:papers.size,items:bank.items.length,occurrences:seenOccurrences.size,parts:bank.stats.parts,explanations:bank.explained.length}));
