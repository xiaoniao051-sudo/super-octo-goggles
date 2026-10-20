import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Run in disposable incognito contexts; never read the user's browser profile.
// GUOKAO_TEST_URL can target the existing Pages site after a release.
// Prefer an installed Playwright; the Codex runtime copy needs no npm install.
const require=createRequire(import.meta.url);
const root=path.dirname(fileURLToPath(import.meta.url));
const candidates=[
 process.env.PLAYWRIGHT_MODULE,
 'playwright',
 path.resolve(path.dirname(process.execPath),'../node_modules/playwright')
].filter(Boolean);
let playwright;
for(const candidate of candidates){try{playwright=require(candidate);break;}catch{}}
if(!playwright)throw Error('Playwright is required. Install it locally or set PLAYWRIGHT_MODULE.');
const browserPath=[
 process.env.BROWSER_EXECUTABLE,
 'C:/Program Files/Google/Chrome/Application/chrome.exe',
 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(p=>p&&existsSync(p));
const remoteTarget=process.env.GUOKAO_TEST_URL;
if(remoteTarget&&remoteTarget!=='https://xiaoniao051-sudo.github.io/super-octo-goggles'){
 throw Error('GUOKAO_TEST_URL must be the existing authorized GitHub Pages site without a trailing slash.');
}
const artifacts=path.join(root,'artifacts',...(remoteTarget?['online']:[]));
await fs.mkdir(artifacts,{recursive:true});
const answers=JSON.parse(await fs.readFile(path.join(root,'answers.json'),'utf8')).answers;
const library=JSON.parse(await fs.readFile(path.join(root,'library.json'),'utf8'));
const key='guokao-2027-study-v1';
const cardId=library.cards[0].id;
const questionId='qa-11111111-2222-4333-8444-555555555555';
const checked=answers.find(a=>a.verification?.status==='checked'&&a.correctOption);
assert.ok(checked,'At least one explicitly checked answer is required');
const draft={paper:'未完成测试草稿',number:'21',subject:'行测',source:'',myAnswer:'',doubt:'保留草稿疑问',stem:''};
const legacy={
 schema:1,cards:{[cardId]:{note:'旧版知识笔记，请完整保留',starred:true,mastered:true}},
 scratchpad:'旧版随手记',updatedAt:'2026-10-19T00:00:00.000Z',
 answerNotes:{[checked.id]:{note:'旧版复盘答案提示不能提前显示',mastered:true,updatedAt:'2026-10-19T00:00:00.000Z'}},
 questions:{[questionId]:{paper:'本机临时测试卷',number:'11',subject:'行测',source:'',myAnswer:'A',doubt:'不懂条件',stem:'本机题干',note:'本机错因',mastered:true,createdAt:'2026-10-19T00:00:00.000Z',updatedAt:'2026-10-19T00:00:00.000Z'}},
 questionDraft:draft
};
const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
 try{
  const filename=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';
  if(filename.includes('/')||filename.includes('\\')||filename.startsWith('.')||!contentTypes[path.extname(filename)]){res.writeHead(404);res.end();return;}
  const data=await fs.readFile(path.join(root,filename));
  res.writeHead(200,{'Content-Type':contentTypes[path.extname(filename)],'Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=remoteTarget||`http://127.0.0.1:${server.address().port}`;
const browser=await playwright.chromium.launch({headless:true,...(browserPath?{executablePath:browserPath}:{})});
const results=[];

async function readState(page){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);}
async function closeModal(page){await page.locator('#close-modal').click();await page.locator('#modal').waitFor({state:'hidden'});}
async function noOverflow(page,where){
 const overflow=await page.evaluate(()=>({
  page:document.documentElement.scrollWidth>innerWidth+1,
  modal:document.querySelector('#modal')?.open&&document.querySelector('#modal').getBoundingClientRect().right>innerWidth+1,
  modalContent:document.querySelector('#modal')?.open&&document.querySelector('#modal-content').scrollWidth>document.querySelector('#modal-content').clientWidth+1
 }));
 assert.equal(overflow.page,false,`${where}: document horizontal overflow`);
 assert.equal(!!overflow.modal,false,`${where}: dialog exceeds viewport`);
 assert.equal(!!overflow.modalContent,false,`${where}: dialog content horizontal overflow`);
}
function preserveLegacy(state){
 assert.equal(state.cards[cardId].note,legacy.cards[cardId].note);
 assert.equal(state.cards[cardId].starred,true);
 assert.equal(state.cards[cardId].mastered,true);
 for(const [field,value]of Object.entries(legacy.questions[questionId]))if(field!=='updatedAt')assert.deepEqual(state.questions[questionId][field],value);
 assert.equal(state.answerNotes[checked.id].note,legacy.answerNotes[checked.id].note);
 assert.equal(state.answerNotes[checked.id].mastered,true);
 assert.equal(state.scratchpad,legacy.scratchpad);
 assert.deepEqual(state.questionDraft,draft);
}

try{
 for(const viewport of [
  {name:'desktop',width:1280,height:900,timezoneId:'Asia/Shanghai'},
  {name:'mobile',width:390,height:844,timezoneId:'America/Los_Angeles'},
  {name:'mobile-narrow',width:320,height:740,timezoneId:'America/Los_Angeles'}
 ]){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},timezoneId:viewport.timezoneId,acceptDownloads:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date('2026-10-20T16:30:00.000Z')});
  await page.goto(base+'/index.html#me');
  await page.locator('#total-cards').filter({hasText:String(library.cards.length)}).waitFor();
  // Exercise the real file-input import path, including a backup predating review attempts.
  const importBackup=async backup=>{
   await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
   await page.waitForFunction(()=>document.querySelector('#import-file').value==='');
  };
  await importBackup(legacy);
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}').schema===2,key);
  preserveLegacy(await readState(page));
  assert.deepEqual((await readState(page)).reviewAttempts,{});

  await page.goto(base+'/index.html#qa');
  await page.locator('[data-qa-tab="practice"]').click();
  await page.locator('#qa-results').filter({hasText:`${answers.length} 道 / 共 ${answers.length} 道`}).waitFor();
  const initialToday=await page.locator('#qa-today').innerText();
  assert.match(initialToday,/0 道到期/);
  assert.match(initialToday,/15 道未开始/);
  assert.match(initialToday,/3 道待核/);
  assert.match(initialToday,/还没有有效复测记录/);
  const listText=await page.locator('#qa-list').textContent();
  for(const answer of answers){
   assert.ok(!listText.includes(answer.title),`${answer.id}: spoiler title in practice list`);
   assert.ok(!listText.includes(answer.answer),`${answer.id}: answer in practice list`);
  }
  // Checking the DOM, not just visibility, catches collapsed or CSS-hidden spoilers.
  for(const answer of answers){
   await page.locator(`#qa-list [data-answer-id="${answer.id}"]`).click();
   const content=await page.locator('#modal-content').textContent();
   for(const spoiler of [answer.title,answer.summary,answer.answer,answer.question?.versionNote,legacy.answerNotes[checked.id].note]){
    if(spoiler)assert.ok(!content.includes(spoiler),`${answer.id}: pre-submit spoiler ${spoiler.slice(0,30)}`);
   }
   assert.equal(await page.locator('#modal-content .qa-explanation').count(),0);
   assert.equal(await page.locator('#modal-content textarea').count(),0);
   assert.equal(await page.getByRole('button',{name:'提交并查看解析',exact:true}).isDisabled(),true);
   await noOverflow(page,`${viewport.name}/${answer.id}`);
   if(answer.id===checked.id){
    await page.screenshot({path:path.join(artifacts,`${viewport.name}-practice.png`),animations:'disabled'});
    await page.locator('.qa-choice-list').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(artifacts,`${viewport.name}-options.png`),animations:'disabled'});
   }
   await closeModal(page);
  }
  await page.locator(`#qa-list [data-answer-id="${checked.id}"]`).click();
  await page.locator(`input[name="practice-option"][value="${checked.correctOption}"]`).check();
  await page.locator('input[name="practice-confidence"][value="sure"]').check();
  await page.getByRole('button',{name:'提交并查看解析',exact:true}).click();
  await page.locator('.qa-attempt-result').waitFor();
  assert.match(await page.locator('.qa-attempt-result').innerText(),/本次复测通过/);
  assert.ok((await page.locator('.qa-explanation').textContent()).includes(checked.answer));
  let state=await readState(page),attempts=state.reviewAttempts[checked.id];
  assert.equal(attempts.length,1);
  assert.equal(attempts[0].selectedOption,checked.correctOption);
  assert.equal(attempts[0].confidence,'sure');
  assert.equal(attempts[0].correct,true);
  assert.equal(attempts[0].localDate,viewport.name==='desktop'?'2026-10-21':'2026-10-20');
  preserveLegacy(state);
  await noOverflow(page,viewport.name+' result');
  await page.screenshot({path:path.join(artifacts,`${viewport.name}-result.png`),animations:'disabled'});
  await closeModal(page);
  const scoredSummary=await page.locator('#qa-today').innerText();
  assert.match(scoredSummary,/复测通过 1 题/);
  assert.match(scoredSummary,/有效作答 1\/1 正确/);
  for(const answer of answers.filter(a=>a.verification.status!=='checked')){
   await page.locator(`#qa-list [data-answer-id="${answer.id}"]`).click();
   await page.locator('input[name="practice-option"][value="A"]').check();
   await page.getByRole('button',{name:'提交并查看解析',exact:true}).click();
   await page.locator('.qa-attempt-result').waitFor();
   assert.match(await page.locator('.qa-attempt-result').innerText(),/暂不判分/);
   state=await readState(page);
   assert.equal(state.reviewAttempts[answer.id].length,1);
   assert.equal(state.reviewAttempts[answer.id][0].correct,null);
   assert.equal(state.reviewAttempts[answer.id][0].confidence,null);
   await closeModal(page);
  }
  assert.match(await page.locator('#qa-today').innerText(),/有效作答 1\/1 正确/);
  assert.match(await page.locator('#qa-today').innerText(),/3 道待核/);

  // Reimporting the old backup twice must not erase or duplicate new attempts.
  await page.goto(base+'/index.html#me');
  await page.locator('#export-btn').waitFor();
  await importBackup(legacy);
  await importBackup(legacy);
  state=await readState(page);
  preserveLegacy(state);
  assert.equal(state.reviewAttempts[checked.id].length,1);
  assert.equal(Object.values(state.reviewAttempts).flat().length,4);
  const downloadEvent=page.waitForEvent('download');
  await page.locator('#export-btn').click();
  const download=await downloadEvent,backupPath=path.join(artifacts,`${viewport.name}-roundtrip-backup.json`);
  await download.saveAs(backupPath);
  const downloaded=JSON.parse(await fs.readFile(backupPath,'utf8'));
  assert.equal(downloaded.schema,2);preserveLegacy(downloaded);
  assert.deepEqual(downloaded.reviewAttempts,state.reviewAttempts);
  const restoredContext=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
  const restoredPage=await restoredContext.newPage();
  await restoredPage.goto(base+'/index.html#me');
  await restoredPage.locator('#export-btn').waitFor();
  await restoredPage.locator('#import-file').setInputFiles(backupPath);
  await restoredPage.waitForFunction(()=>document.querySelector('#import-file').value==='');
  const restored=await readState(restoredPage);
  preserveLegacy(restored);assert.deepEqual(restored.reviewAttempts,downloaded.reviewAttempts);
  await restoredContext.close();

  // Reading mode still contains the old note and keeps its independent mastery checkbox.
  await page.goto(base+'/index.html#qa');
  await page.locator('[data-qa-tab="published"]').click();
  await page.locator(`#qa-list [data-answer-id="${checked.id}"]`).click();
  assert.equal(await page.locator('.qa-note-section textarea').inputValue(),legacy.answerNotes[checked.id].note);
  assert.equal(await page.locator('.qa-note-section input[type="checkbox"]').isChecked(),true);
  await page.getByRole('button',{name:'独立重做这道题',exact:true}).click();
  assert.equal(await page.locator('[data-qa-tab="practice"]').getAttribute('aria-pressed'),'true');
  for(const answer of answers)assert.ok(!(await page.locator('#qa-list').textContent()).includes(answer.title),`${answer.id}: background list leaks after reading-to-practice`);
  assert.equal(await page.locator('#modal-content .qa-explanation').count(),0);
  const wrong=checked.question.options.find(o=>o.label!==checked.correctOption).label;
  await page.locator(`input[name="practice-option"][value="${wrong}"]`).check();
  await page.locator('input[name="practice-confidence"][value="guess"]').check();
  await page.getByRole('button',{name:'提交并查看解析',exact:true}).click();
  await page.locator('.qa-attempt-result').waitFor();
  assert.match(await page.locator('.qa-attempt-result').innerText(),/本次答错/);
  state=await readState(page);
  assert.equal(state.reviewAttempts[checked.id].length,2);
  assert.equal(state.reviewAttempts[checked.id].at(-1).correct,false);
  assert.equal(state.reviewAttempts[checked.id].at(-1).confidence,'guess');
  assert.equal(state.answerNotes[checked.id].mastered,true);
  await closeModal(page);
  await page.clock.setFixedTime(new Date('2026-10-21T16:30:00.000Z'));
  await page.goto(base+'/index.html#review');
  await page.locator('#review-today .qa-today-count').filter({hasText:'1 道到期'}).waitFor();
  assert.match(await page.locator('#review-today').innerText(),/14 道未开始/);
  assert.match(await page.locator('#review-today').innerText(),/有效作答 1\/2 正确/);
  await page.clock.runFor(4000);
  await page.screenshot({path:path.join(artifacts,`${viewport.name}-queue.png`),fullPage:true,animations:'disabled'});
  await page.locator('#review-today').getByRole('button',{name:'开始今日复习',exact:true}).click();
  assert.equal(await page.locator('#modal-content').getAttribute('data-answer-id'),checked.id);
  assert.equal(await page.locator('#modal-content .qa-explanation').count(),0);
  await closeModal(page);
  await noOverflow(page,viewport.name);
  assert.deepEqual(errors,[],`${viewport.name} has browser errors`);
  results.push({viewport:viewport.name,size:`${viewport.width}×${viewport.height}`,timezone:viewport.timezoneId,questionsChecked:answers.length,legacyImport:true,backupRoundtrip:true,neutralPracticeDOM:true,pausedUnscored:3,nextLocalDayQueue:true,browserErrors:errors});
  await context.close();
 }
 await fs.writeFile(path.join(artifacts,'browser-results.json'),JSON.stringify({base,browser:await browser.version(),results},null,2));
 console.log(JSON.stringify({base,browser:await browser.version(),results},null,2));
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
