const {test} = require('node:test');
const assert = require('node:assert/strict');
const {load,source} = require('./helpers.cjs');
const {prepareInsightInput,maskDirectIdentifiers} = load('privacy');
const {createMockClassifier,createOpenAIClassifier,validateClassification} = load('classifier');
const {createInMemoryInsightRepository,processInsightBatch} = load('processor');
const now=new Date('2026-10-14T21:00:00.000Z');
const valid={kind:'question',topicIds:['feedback'],normalizedDemand:'Preparar feedback.',confidence:.9,needsReview:false};
test('preparation excludes administrative/other-user/future context and minimizes direct identifiers',()=>{
 const message=source({id:5,input:'Meu email é teste@example.com e CPF 123.456.789-00.'});
 const prior=source({id:1,createdAt:'2026-10-13T12:00:00.000Z'});
 const candidates=[prior,source({id:2,input:'ADMIN_SECRET',userLevel:'admin',createdAt:prior.createdAt}),source({id:3,userId:'other',input:'OTHER_SECRET',createdAt:prior.createdAt}),source({id:6,input:'FUTURE_SECRET',createdAt:'2026-10-15T12:00:00.000Z'})];
 const prepared=prepareInsightInput(message,candidates,'v1','mock.v1');
 assert.deepEqual(prepared.context.map(c=>c.id),[1]);
 assert.ok(!prepared.text.includes('teste@example.com'));assert.ok(!prepared.text.includes('123.456.789-00'));
 assert.notEqual(prepared.sourceHash,prepareInsightInput(message,[], 'v1','mock.v1').sourceHash);
 assert.throws(()=>prepareInsightInput(source({userLevel:'admin'}),[],'v1','mock.v1'),/not_eligible/);
 assert.ok(maskDirectIdentifiers('https://example.com').includes('[URL]'));
});
test('invalid structured output and unsupported themes fail explicitly',()=>{
 for(const value of [{...valid,topicIds:['invented']},{...valid,confidence:2},{...valid,confidence:.1},{...valid,extra:'x'}])assert.throws(()=>validateClassification(value));
 assert.deepEqual(validateClassification(valid),valid);
});
test('mock batches advance across runs and are idempotent, excluding admins',async()=>{
 const sources=Array.from({length:5},(_,i)=>source({id:i+1,chatId:'chat-'+i}));
 sources.unshift(source({id:99,userLevel:'admin',userId:'admin'}));
 const repo=createInMemoryInsightRepository(sources);const classifier=createMockClassifier();
 const options={repository:repo,classifier,maxMessages:2,now};
 await processInsightBatch(options);await processInsightBatch(options);await processInsightBatch(options);
 assert.equal((await repo.listCompleted()).length,5);
 const repeated=await processInsightBatch(options);assert.equal(repeated.completed,0);
 assert.ok((await repo.listCompleted()).every(r=>r.userId!=='admin'));
 repo.setCurrentUserLevel('synthetic-user','admin');
 await processInsightBatch(options);assert.equal((await repo.listCompleted()).length,0);
});
test('oversize source is recorded as rejected, not silently truncated',async()=>{
 const repo=createInMemoryInsightRepository([source({input:'x'.repeat(6001)})]);
 const result=await processInsightBatch({repository:repo,classifier:createMockClassifier(),now});
 assert.equal(result.failed,1);assert.equal((await repo.listCompleted()).length,0);
 assert.equal((await repo.listJobs())[0].status,'failed');
});
test('transient classification failures wait before retry and then recover',async()=>{
 let calls=0;const mock=createMockClassifier();
 const classifier={...mock,async classify(input){if(++calls===1)throw new Error('synthetic transient');return mock.classify(input);}};
 const repo=createInMemoryInsightRepository([source()]);
 assert.equal((await processInsightBatch({repository:repo,classifier,now})).failed,1);
 assert.equal((await processInsightBatch({repository:repo,classifier,now})).pending,1);assert.equal(calls,1);
 assert.equal((await processInsightBatch({repository:repo,classifier,now:new Date(now.getTime()+61000)})).completed,1);
});
test('OpenAI adapter is disabled with key alone; injected transport verifies payload and reasoning accounting',async()=>{
 const old=process.env.INSIGHTS_OPENAI_ENABLED;delete process.env.INSIGHTS_OPENAI_ENABLED;
 let calls=0;let payload;
 const adapter=createOpenAIClassifier({apiKey:'synthetic-never-transmitted',fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');payload=JSON.parse(options.body);
  return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(valid)}]}],usage:{input_tokens:100,output_tokens:60,total_tokens:160,output_tokens_details:{reasoning_tokens:40}}}),{status:200});
 }});
 const prepared=prepareInsightInput(source(),[],'v1',adapter.version);
 try {
  await assert.rejects(adapter.classify(prepared),/openai_disabled/);assert.equal(calls,0);
  process.env.INSIGHTS_OPENAI_ENABLED='true';
  const result=await adapter.classify(prepared);
  assert.equal(payload.store,false);assert.equal(payload.model,'gpt-6-luna');assert.equal(payload.reasoning.effort,'low');
  assert.equal(payload.text.format.type,'json_schema');assert.equal(payload.text.format.strict,true);
  assert.equal(result.usage.outputTokens,60);assert.equal(result.usage.reasoningTokens,40);assert.equal(result.usage.totalTokens,160);
 } finally {if(old===undefined)delete process.env.INSIGHTS_OPENAI_ENABLED;else process.env.INSIGHTS_OPENAI_ENABLED=old;}
});
test('OpenAI budget blocks calls and is shared across batches and concurrent workers',async()=>{
 const old=process.env.INSIGHTS_OPENAI_ENABLED;process.env.INSIGHTS_OPENAI_ENABLED='true';
 let calls=0;const repo=createInMemoryInsightRepository([source(),source({id:2,chatId:'second'})]);
 const classifier={provider:'openai',version:'synthetic.v1',async classify(){calls++;return {classification:valid,usage:null};}};
 try {
  assert.equal((await processInsightBatch({repository:repo,classifier,maxSpendUsd:0,now})).budgetStopped,true);assert.equal(calls,0);
  await Promise.all([processInsightBatch({repository:repo,classifier,maxSpendUsd:.005,now}),processInsightBatch({repository:repo,classifier,maxSpendUsd:.005,now})]);
  assert.equal(calls,1);await processInsightBatch({repository:repo,classifier,maxSpendUsd:.005,now});assert.equal(calls,1);
 } finally {if(old===undefined)delete process.env.INSIGHTS_OPENAI_ENABLED;else process.env.INSIGHTS_OPENAI_ENABLED=old;}
});
test('validated usage settles the conservative reservation without billing reasoning twice',async()=>{
 const old=process.env.INSIGHTS_OPENAI_ENABLED;process.env.INSIGHTS_OPENAI_ENABLED='true';
 const repo=createInMemoryInsightRepository([source()]);
 const classifier={provider:'openai',version:'synthetic.v1',async classify(){return {classification:valid,usage:{inputTokens:1000,outputTokens:800,totalTokens:1800,reasoningTokens:600}};}};
 try {
  const result=await processInsightBatch({repository:repo,classifier,maxSpendUsd:.005,now});
  assert.equal(result.completed,1);assert.equal(result.estimatedCostUsd,.0005);assert.equal(result.releasedUsd,.0045);
  assert.equal(result.usage.outputTokens,800);assert.equal(result.usage.reasoningTokens,600);
 } finally {if(old===undefined)delete process.env.INSIGHTS_OPENAI_ENABLED;else process.env.INSIGHTS_OPENAI_ENABLED=old;}
});
test('role changed during classification excludes the result before storage',async()=>{
 const repo=createInMemoryInsightRepository([source()]);
 const classifier={provider:'mock',version:'synthetic.v1',async classify(){repo.setCurrentUserLevel('synthetic-user','admin');return {classification:valid,usage:null};}};
 const result=await processInsightBatch({repository:repo,classifier,now});
 assert.equal(result.completed,0);assert.equal(result.excluded,1);assert.equal((await repo.listCompleted()).length,0);
});
