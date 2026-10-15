const {test}=require('node:test');const assert=require('node:assert/strict');
const {load,source}=require('./helpers.cjs');
const {processInsightBatch,createInMemoryInsightRepository}=load('processor');
const {runDailyInsights}=load('daily');
const now=new Date('2026-10-15T12:00:00Z');
test('approved nano adapter uses matching model, output bound and conservative token rates',async()=>{
 const {createOpenAIClassifier}=load('classifier'),{prepareInsightInput}=load('privacy');const old=process.env.INSIGHTS_OPENAI_ENABLED;process.env.INSIGHTS_OPENAI_ENABLED='true';
 let payload;const classifier=createOpenAIClassifier({model:'gpt-5.4-nano',apiKey:'synthetic',fetchImpl:async(_url,options)=>{payload=JSON.parse(options.body);return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({kind:'question',topicIds:['feedback'],normalizedDemand:'Preparar feedback.',confidence:.9,needsReview:false})}]}],usage:{input_tokens:1000,output_tokens:800,total_tokens:1800,output_tokens_details:{reasoning_tokens:600}}}),{status:200});}});
 try {const repo=createInMemoryInsightRepository([source()]);const result=await processInsightBatch({repository:repo,classifier,maxSpendUsd:.01,reserveUsdPerCall:.01,now});assert.equal(payload.model,'gpt-5.4-nano');assert.equal(payload.max_output_tokens,1200);assert.equal(payload.store,false);assert.equal(result.estimatedCostUsd,.0012);assert.equal(result.releasedUsd,.0088);assert.match(classifier.version,/^gpt-5\.4-nano\./);assert.throws(()=>createOpenAIClassifier({model:'unapproved'}),/unapproved_model/);}finally{if(old===undefined)delete process.env.INSIGHTS_OPENAI_ENABLED;else process.env.INSIGHTS_OPENAI_ENABLED=old;}
});
test('pilot classifies selected IDs while retaining preceding context outside sample',async()=>{
 const repo=createInMemoryInsightRepository([source({id:1,createdAt:'2026-10-14T10:00:00Z'}),source({id:2,createdAt:'2026-10-14T11:00:00Z'}),source({id:3})]);let calls=0;
 const classifier={provider:'mock',version:'pilot.v1',async classify(input){calls++;assert.equal(input.source.id,2);assert.ok(input.context.some(c=>c.id===1));return {classification:{kind:'question',topicIds:['feedback'],normalizedDemand:'Preparar feedback.',confidence:.9,needsReview:false},usage:null};}};
 const result=await processInsightBatch({repository:repo,classifier,sourceIds:[2],now});assert.equal(result.completed,1);assert.equal(calls,1);assert.equal((await repo.listJobs()).length,1);
 await assert.rejects(processInsightBatch({repository:repo,classifier,sourceIds:[2,2],now}),/pilot_sources/);
});
test('deadline yields without acquiring a lease or spending when insufficient time remains',async()=>{
 const repo=createInMemoryInsightRepository([source()]);let calls=0;
 const classifier={provider:'mock',version:'pilot.v1',async classify(){calls++;throw Error('must not call');}};
 const result=await processInsightBatch({repository:repo,classifier,now,deadline:new Date(now.getTime()+30_000)});
 assert.equal(calls,0);assert.equal(result.hasMore,true);assert.equal((await repo.listJobs()).length,0);
});
test('provider diagnostics persist only bounded codes, never arbitrary exception content',async()=>{
 for(const [failure,expected] of [[new Error('invalid_normalized_demand'),'invalid_normalized_demand'],[Object.assign(new Error('aborted'),{name:'AbortError'}),'openai_timeout'],[new Error('private source or provider detail'),'classification_failed']]){
 const repo=createInMemoryInsightRepository([source()]);const classifier={provider:'mock',version:'pilot.v1',async classify(){throw failure;}};
 const result=await processInsightBatch({repository:repo,classifier,now});assert.equal(result.failed,1);const jobs=await repo.listJobs();assert.equal(jobs[0].errorCode,expected);assert.ok(!JSON.stringify(jobs).includes('private source'));}
});
test('provider cannot suppress mandatory review for a low-confidence classification',async()=>{
 const {createOpenAIClassifier}=load('classifier'),{prepareInsightInput}=load('privacy');const old=process.env.INSIGHTS_OPENAI_ENABLED;process.env.INSIGHTS_OPENAI_ENABLED='true';
 try{const classifier=createOpenAIClassifier({model:'gpt-5.4-nano',apiKey:'synthetic',fetchImpl:async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({kind:'question',topicIds:['feedback'],normalizedDemand:'Preparar feedback.',confidence:.5,needsReview:false})}]}]}),{status:200})});const result=await classifier.classify(prepareInsightInput(source(),[],'v1',classifier.version));assert.equal(result.classification.confidence,.5);assert.equal(result.classification.needsReview,true);}finally{if(old===undefined)delete process.env.INSIGHTS_OPENAI_ENABLED;else process.env.INSIGHTS_OPENAI_ENABLED=old;}
});
test('daily pilot rejects empty, duplicate, invalid or oversized manifests before database access',async()=>{
 const env={INSIGHTS_MODE:'live',INSIGHTS_PROCESSING_ENABLED:'true',INSIGHTS_OPENAI_ENABLED:'true',OPENAI_API_KEY:'synthetic',INSIGHTS_MAX_SPEND_USD:'1'};
 for(const ids of ['', '1,1','x','0',Array.from({length:201},(_,i)=>i+1).join(',')])await assert.rejects(runDailyInsights({env:{...env,INSIGHTS_PILOT_SOURCE_IDS:ids}}),/pilot_sources/);
});
