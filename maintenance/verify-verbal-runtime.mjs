// Input is a temporary, non-public {paperId: markdown} map from pinned sources.
// Only audit metadata is emitted; never commit the input or third-party text.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {parseVerbalSource} from '../verbal-source-parser.js';
const input=process.argv[2];
if(!input)throw Error('Usage: node maintenance/verify-verbal-runtime.mjs /tmp/source-map.json');
const bank=JSON.parse(fs.readFileSync(new URL('../verbal-bank.json',import.meta.url)));
const sources=JSON.parse(fs.readFileSync(input));
const reports=[];
for(const paper of bank.papers.filter(p=>['guokao','fujian'].includes(p.exam))){
 const md=sources[paper.id];if(typeof md!=='string')throw Error('Missing source: '+paper.id);
 const rows=bank.items.flatMap(item=>item.occurrences.filter(o=>o.paperId===paper.id));
 const result=parseVerbalSource(md,{sourceUrl:paper.url,expectedTitle:paper.title,expectedYear:paper.year,expectedCount:rows.length,bindings:rows});
 const bytes=Buffer.from(md),sourceBlobSha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 reports.push({paperId:paper.id,paper:paper.title,sourceUrl:paper.url,sourceBlobSha,parsed:result.parsedCount,expected:rows.length,playable:result.questions.filter(q=>q.sourceTextComplete).length,materials:result.materials.length,materialQuestionNumbers:result.questions.filter(q=>q.material).map(q=>q.moduleNumber),referenceAnswers:result.questions.filter(q=>q.referenceAnswer.value).length,warnings:result.warnings,questionWarnings:result.questions.filter(q=>q.warnings.length).map(q=>({number:q.moduleNumber,warnings:q.warnings})),allAnswersUnverified:result.questions.every(q=>!q.referenceAnswer.independentlyVerified&&!q.eligibleForVerifiedStats),hasExplanationField:result.questions.some(q=>'explanation' in q)});
}
const sum=key=>reports.reduce((n,r)=>n+r[key],0);
const report={date:new Date().toISOString().slice(0,10),method:'Node parser audit of connector-fetched pinned source files; not browser or device acceptance',papers:reports.length,questions:sum('parsed'),playableQuestions:sum('playable'),referenceAnswers:sum('referenceAnswers'),warningCount:reports.reduce((n,r)=>n+r.warnings.length+r.questionWarnings.length,0),countsMatch:reports.every(r=>r.parsed===r.expected),allAnswersUnverified:reports.every(r=>r.allAnswersUnverified),hasExplanationField:reports.some(r=>r.hasExplanationField),reports,materialQuestionCount:reports.reduce((n,r)=>n+r.materialQuestionNumbers.length,0),sharedPassageCount:sum('materials')};
fs.writeFileSync(new URL('./verbal-runtime-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,reports:undefined}));
if(report.warningCount||!report.countsMatch||report.playableQuestions!==report.questions)process.exitCode=1;
