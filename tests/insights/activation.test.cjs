const {test} = require('node:test');
const assert = require('node:assert/strict');
const {load,source} = require('./helpers.cjs');
const {verifyInsightsWorker} = load('worker-auth');
const {runDailyInsights} = load('daily');
const {createSupabaseInsightRepository} = load('supabase-repository');
const {createInMemoryInsightRepository} = load('processor');
const secret='synthetic-worker-secret-over-32-characters';
test('worker cannot be started by default or by an admin cookie',()=>{
 const req=new Request('http://localhost/api/insights/process',{headers:{cookie:'auth_token=synthetic'}});
 assert.throws(()=>verifyInsightsWorker(req,{}),e=>e.status===503);
 const enabled={INSIGHTS_MODE:'live',INSIGHTS_PROCESSING_ENABLED:'true',INSIGHTS_OPENAI_ENABLED:'true',INSIGHTS_CRON_SECRET:secret};
 assert.throws(()=>verifyInsightsWorker(req,enabled),e=>e.status===401);
 assert.throws(()=>verifyInsightsWorker(new Request(req.url,{headers:{authorization:'Bearer wrong'}}),enabled),e=>e.status===401);
 assert.doesNotThrow(()=>verifyInsightsWorker(new Request(req.url,{headers:{authorization:'Bearer '+secret}}),enabled));
});
test('repository construction is inert and rejects non-live mode before database access',async()=>{
 let calls=0;
 const client={from(){calls++;throw new Error('Unexpected database access');},rpc:async(name,args)=>{calls++;assert.equal(name,'insights_reserve_budget');assert.deepEqual(args,{p_scope:'pilot',p_amount_usd:.005,p_cap_usd:1});return {data:true,error:null};}};
 assert.throws(()=>createSupabaseInsightRepository(client,{env:{},now:new Date('2026-10-14T21:00:00Z')}),/live_disabled/);
 const repo=createSupabaseInsightRepository(client,{env:{INSIGHTS_MODE:'live'},now:new Date('2026-10-14T21:00:00Z')});
 assert.equal(calls,0);assert.equal(await repo.reserveBudget('pilot',.005,1),true);assert.equal(calls,1);
});
test('daily runner fails closed without explicit flags, key and approved positive budget',async()=>{
 let calls=0;
 const classifier={provider:'openai',version:'synthetic.v1',async classify(){calls++;return {classification:{kind:'question',topicIds:['feedback'],normalizedDemand:'Preparar feedback.',confidence:.9,needsReview:false},usage:null};}};
 const repository=createInMemoryInsightRepository([source()]);
 await assert.rejects(runDailyInsights({env:{},repository,classifier}),/processing_disabled/);
 const enabled={INSIGHTS_MODE:'live',INSIGHTS_PROCESSING_ENABLED:'true',INSIGHTS_OPENAI_ENABLED:'true'};
 await assert.rejects(runDailyInsights({env:enabled,repository,classifier}),/key_missing/);
 await assert.rejects(runDailyInsights({env:{...enabled,OPENAI_API_KEY:'synthetic'},repository,classifier}),/budget/);
 await assert.rejects(runDailyInsights({env:{...enabled,OPENAI_API_KEY:'synthetic',INSIGHTS_MAX_SPEND_USD:'6'},repository,classifier}),/budget/);
 assert.equal(calls,0);
});
