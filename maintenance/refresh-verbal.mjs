// verbal-bank.json is the source of truth. Recompute summaries, never IDs or content.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateBank,PARTS} from '../verbal-model.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const bank=validateBank(JSON.parse(fs.readFileSync(root+'verbal-bank.json','utf8')));
bank.stats={...bank.stats,occurrences:bank.items.reduce((n,q)=>n+q.occurrences.length,0),uniqueItems:bank.items.length,papers:bank.papers.length,parts:Object.fromEntries(PARTS.map(part=>[part,bank.items.filter(q=>q.part===part).length])),existingExplanations:bank.explained.length};
const coverage={updatedAt:bank.updatedAt,scopeNote:bank.scopeNote,stats:bank.stats,maintenanceBatch:bank.maintenanceBatch,runtimePractice:bank.runtimePractice,papers:bank.papers.map(p=>({...p,parts:Object.fromEntries(PARTS.map(part=>[part,bank.items.filter(q=>q.part===part).reduce((n,q)=>n+q.occurrences.filter(o=>o.paperId===p.id).length,0)]))})),gaps:bank.gaps,sourceCatalog:bank.sourceCatalog};
fs.writeFileSync(root+'verbal-bank.json',JSON.stringify(bank)+'\n');
fs.writeFileSync(root+'maintenance/verbal-coverage.json',JSON.stringify(coverage,null,2)+'\n');
console.log(JSON.stringify({result:'refreshed',...bank.stats}));
