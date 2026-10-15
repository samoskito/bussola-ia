// UI-only verification with intercepted synthetic responses. No real login/data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {load,root} = require('./helpers.cjs');
const {buildDemoReport} = load('report');
const {parseInsightFilters} = load('filters');
const {reportToCsv} = load('service');
const packageDir=process.env.INSIGHTS_BROWSER_MODULES;
if(!packageDir)throw new Error('Set INSIGHTS_BROWSER_MODULES to the bundled Node packages directory');
const {chromium}=require(path.join(packageDir,'playwright'));
const base='http://127.0.0.1:3100';
const previewDate=new Date('2026-10-14T21:00:00Z');
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,...(process.env.INSIGHTS_BROWSER_EXECUTABLE?{executablePath:process.env.INSIGHTS_BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1050}});
 await context.addCookies([{name:'auth_token',value:'synthetic-browser-preview-only',url:base,httpOnly:true}]);
 let role='admin';let reportStatus=200;let apiRequests=0;const errors=[];
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==base)return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  apiRequests++;
  if(url.pathname==='/api/auth/session')return route.fulfill({json:{user:{id:'10000000-0000-4000-8000-000000000001',email:'admin@example.invalid',nome:'Admin de demonstração',nivel:role,created_at:previewDate.toISOString(),data_expiracao:null,plano:'Todas'}}});
  if(url.pathname==='/api/chats')return route.fulfill({json:{chats:[]}});
  if(url.pathname.startsWith('/api/insights/')){
   if(reportStatus!==200)return route.fulfill({status:reportStatus,json:{error:'synthetic error',code:reportStatus===503?'insights_disabled':'forbidden'}});
   const report=buildDemoReport(parseInsightFilters(url.searchParams,url.pathname.endsWith('/export')),previewDate);
   if(url.pathname.endsWith('/export')&&url.searchParams.get('format')==='csv')return route.fulfill({contentType:'text/csv',body:reportToCsv(report)});
   return route.fulfill({json:report});
  }
  return route.fulfill({status:403,json:{error:'No real data permitted in browser preview'}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/dashboard/insights',{waitUntil:'networkidle',timeout:90000});
 await page.getByText('Demonstração · dados simulados',{exact:true}).waitFor();
 assert.ok((await page.locator('body').innerText()).includes('160'));
 const artifactDir=path.join(root,'docs/audits');fs.mkdirSync(artifactDir,{recursive:true});
 await page.screenshot({path:path.join(artifactDir,'insights-demo-desktop.png')});
 await page.getByRole('combobox',{name:/^Período/}).selectOption('7');
 await page.getByText('Demonstração · dados simulados',{exact:true}).waitFor();
 await page.getByRole('combobox',{name:/^Agente de IA/}).selectOption('conversas_dificeis');
 await page.getByRole('button',{name:'Exportar CSV',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('button')&&document.body.innerText.includes('Cobertura de classificação'));
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();
 const download=await downloadPromise;assert.match(download.suggestedFilename(),/demonstracao/);
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('combobox',{name:/^Período/}).selectOption('30');
 await page.getByRole('combobox',{name:/^Agente de IA/}).selectOption('all');
 await page.getByRole('heading',{name:'Mais pessoas, mais recorrência'}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.screenshot({path:path.join(artifactDir,'insights-demo-mobile.png')});
 reportStatus=503;await page.reload({waitUntil:'networkidle'});await page.getByRole('heading',{name:'Insights ainda não ativados'}).waitFor();
 role='user';await page.reload({waitUntil:'networkidle'});await page.getByRole('heading',{name:'Insights exclusivos para administradores'}).waitFor();
 assert.deepEqual(errors,[]);
 await browser.close();console.log(JSON.stringify({ui:'passed',desktop:true,mobileNoOverflow:true,filters:true,csvDownload:true,disabledState:true,nonAdminDenied:true,apiRequests,realDataAccess:false}));
})().catch(async e=>{console.error(e.message);await browser?.close();process.exitCode=1;});
