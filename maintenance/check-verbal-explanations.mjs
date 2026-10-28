// Input source map is local-only; this audit prints counts, not source text.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {parseVerbalSource} from '../verbal-source-parser.js';
import {adaptSourceQuestion,submissionResult} from '../verbal-practice-model.js';
import {createExplanationIndex,withExplanation} from '../verbal-explanations.js';
import {reviewEvidenceKey,gradeAnswer} from '../review.js';
const bank=JSON.parse(fs.readFileSync(new URL('../verbal-bank.json',import.meta.url)));
const data=JSON.parse(fs.readFileSync(new URL('../verbal-explanations.json',import.meta.url)));
const index=createExplanationIndex(data),expected=new Set(bank.items.filter(q=>q.occurrences.some(o=>bank.papers.some(p=>p.id===o.paperId&&['guokao','fujian'].includes(p.exam)))).map(q=>q.id));
assert.equal(index.size,expected.size);
for(const id of expected)assert(index.has(id),'Missing '+id);
for(const r of index.values()){
 assert(expected.has(r.id),'Unexpected '+r.id);
 assert(r.reason.length>=35&&r.tip.length>=8&&Object.values(r.distractors).every(s=>s.length>=7),'Thin '+r.id);
 assert(!('question' in r)&&!('sourceMarkdown' in r));
}
let checkedOccurrences=0,checkedPapers=0;
if(process.argv[2]){
 const sources=JSON.parse(fs.readFileSync(process.argv[2]));
 for(const paper of bank.papers.filter(p=>['guokao','fujian'].includes(p.exam))){
  const rows=bank.items.flatMap(item=>item.occurrences.filter(o=>o.paperId===paper.id).map(o=>({item,o})));
  const parsed=parseVerbalSource(sources[paper.id],{sourceUrl:paper.url,expectedTitle:paper.title,expectedYear:paper.year,expectedCount:rows.length,bindings:rows.map(r=>r.o)});
  for(const {item,o} of rows){
   const q=parsed.questions.find(q=>String(q.qid)===String(o.qid)&&q.moduleNumber===o.moduleNumber);assert(q?.sourceTextComplete);
   const a=adaptSourceQuestion(q,item,o,paper),enriched=withExplanation(a,index);assert(enriched.explanation,'Unbound '+item.id);
   assert.equal(reviewEvidenceKey(a),reviewEvidenceKey(enriched));
   assert.equal(a.correctOption,enriched.correctOption);
   assert.equal(enriched.explanation.answer===a.correctOption||enriched.explanation.status==='disputed',true);
   for(const letter of ['A','B','C','D']){assert.equal(gradeAnswer(enriched,letter),null);if(enriched.explanation.status==='disputed')assert.equal(submissionResult(enriched,letter).kind,'disputed');}
   checkedOccurrences++;
  }checkedPapers++;
 }
 assert.equal(checkedOccurrences,bank.runtimePractice.sourceOccurrences);assert.equal(checkedPapers,bank.runtimePractice.sourcePapers);
}
console.log(JSON.stringify({status:'passed',explanations:index.size,checkedPapers,checkedOccurrences,disputed:[...index.values()].filter(r=>r.status==='disputed').length,questionBindingChecked:!!process.argv[2]}));
