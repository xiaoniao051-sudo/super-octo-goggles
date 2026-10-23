// Local-only browser acceptance. Optional source map contains externally fetched
// pinned Markdown outside the repository; never retain third-party text here.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {rawSourceUrl} from './verbal-source-parser.js';
const root=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
const bank=JSON.parse(await readFile(path.join(root,'verbal-bank.json'),'utf8'));
const sourceMap=process.env.GUOKAO_SOURCE_MAP?JSON.parse(await readFile(process.env.GUOKAO_SOURCE_MAP,'utf8')):null;
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png'};
const server=createServer(async(req,res)=>{try{
 const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/super-octo-goggles\//,'')||'index.html';
 if(name.includes('/')||name.includes('..')||!types[path.extname(name)])throw Error('Invalid path');
 res.setHeader('Content-Type',types[path.extname(name)]+'; charset=utf-8');res.end(await readFile(path.join(root,name)));
}catch{res.writeHead(404);res.end();}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser;
const results=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const base=`http://127.0.0.1:${server.address().port}/super-octo-goggles/`;
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let releaseDelayed,delayNext=false;
  if(sourceMap)await context.route('https://raw.githubusercontent.com/**',async route=>{
   const paper=bank.papers.find(p=>{try{return rawSourceUrl(p.url)===route.request().url();}catch{return false;}});
   if(!paper||!sourceMap[paper.id])return route.abort();
   if(delayNext){delayNext=false;await new Promise(resolve=>{releaseDelayed=resolve;});}
   await route.fulfill({contentType:'text/plain',body:sourceMap[paper.id]});
  });
  const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width}px overflow`);
  const choice=async n=>page.locator('.practice-option').nth(n).click();
  const submit=async()=>page.getByRole('button',{name:'提交答案',exact:true}).click();
  await page.goto(base+'verbal.html');await page.locator('.practice-question').waitFor();
  for(const part of ['逻辑填空','片段阅读','语句表达']){
   await page.locator(`[data-part="${part}"]`).click();
   assert.equal(await page.locator('.practice-option').count(),4);
   assert.equal(await page.locator('.practice-feedback').count(),0);await overflow();
  }
  await page.locator('[data-part="逻辑填空"]').click();
  await page.locator('#exam-filter').selectOption('guokao');await page.locator('#year-filter').selectOption('2023');
  await page.locator('#bank-search').fill('37');
  assert.match(await page.locator('.practice-question h2').textContent(),/37/);
  assert.equal(await page.locator('.practice-feedback').count(),0);
  await choice(0);await submit();assert.match(await page.locator('.practice-feedback').textContent(),/这题答错了/);
  await page.getByRole('textbox',{name:'这道题的错因或笔记'}).fill('浏览器本地验收笔记');
  await page.getByRole('button',{name:'保存笔记',exact:true}).click();
  await page.reload();await choice(3);await submit();
  assert.equal(await page.getByRole('textbox',{name:'这道题的错因或笔记'}).inputValue(),'浏览器本地验收笔记');
  await page.locator('[data-view="mistakes"]').click();await page.getByRole('button',{name:'重新做这题',exact:true}).click();
  assert.equal(await page.locator('.practice-feedback').count(),0);
  await page.locator('#clear-filters').click();await page.locator('[data-view="practice"]').click();
  await choice(0);await submit();await page.getByRole('button',{name:'下一题',exact:true}).click();
  assert.equal(await page.locator('.practice-feedback').count(),0);assert.equal(await page.locator('[aria-checked="true"]').count(),0);
  await choice(0);await submit();
  const before=await page.locator('.practice-question h2').textContent();
  await page.getByRole('textbox',{name:'这道题的错因或笔记'}).fill('保存失败不能丢');
  await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('test denied');};});
  await page.getByRole('button',{name:'下一题',exact:true}).click();assert.equal(await page.locator('.practice-question h2').textContent(),before);
  assert.equal(await page.getByRole('textbox',{name:'这道题的错因或笔记'}).inputValue(),'保存失败不能丢');
  await page.evaluate(()=>{Storage.prototype.setItem=window.originalSet;});await page.getByRole('button',{name:'保存笔记',exact:true}).click();
  if(sourceMap){
   const paper=bank.papers.find(p=>p.exam==='guokao'&&p.year===2021&&p.title.includes('副省'));
   await page.locator('[data-part="片段阅读"]').click();await page.locator('#practice-paper').selectOption(paper.id);
   delayNext=true;await page.getByRole('button',{name:'载入题目，开始做',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#bank-count').textContent.includes('正在载入'));
   await page.locator('#practice-paper').selectOption('known');
   while(!releaseDelayed)await new Promise(resolve=>setTimeout(resolve,10));
   releaseDelayed();await page.waitForTimeout(100);
   assert.equal(await page.locator('#practice-paper').inputValue(),'known');
   await page.locator('#practice-paper').selectOption(paper.id);await page.getByRole('button',{name:'载入题目，开始做',exact:true}).click();
   await page.locator('.practice-material').waitFor();assert.equal(await page.locator('.practice-option').count(),4);
   assert.equal(await page.locator('.practice-feedback').count(),0);await overflow();await choice(0);await submit();
   assert.match(await page.locator('.practice-feedback').textContent(),/来源参考答案/);
   const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('guokao-2027-study-v1')));
   const remoteIds=new Set(bank.items.map(q=>q.id));
   const attempts=Object.entries(state.reviewAttempts).filter(([id])=>remoteIds.has(id)).flatMap(([,rows])=>rows);
   assert.equal(attempts.length,1);assert.equal(attempts[0].correct,null);
  }
  await page.goto(base+'verbal.html?view=index&exam=shiye&year=2022&q=49&part='+encodeURIComponent('片段阅读'));
  await page.waitForFunction(()=>document.querySelector('#bank-count').textContent.includes('组分类索引'));
  assert.match(await page.locator('#bank-list').textContent(),/2022年9月3日/);await overflow();
  assert.deepEqual(errors,[]);results.push({width,subpath:true,threeParts:true,filtersAndSearch:true,preSubmitHidden:true,nextAndMistakeRetry:true,noteSurvivesReload:true,failedSaveProtected:true,sharedMaterialAndReferenceUnscored:!!sourceMap,asyncSwitchProtected:!!sourceMap,noHorizontalOverflow:true});
  await context.close();
 }
 const report={date:new Date().toISOString().slice(0,10),browser:browser.version(),environment:'Desktop Chromium responsive viewports; not iPhone/WeChat',sourceMode:sourceMap?'Pinned external source text replayed locally; not live network acceptance':'Runtime source loading not tested',results};
 await mkdir(path.join(root,'artifacts'),{recursive:true});await writeFile(path.join(root,'artifacts/verbal-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
