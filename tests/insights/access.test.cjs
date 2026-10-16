const {test} = require('node:test');
const assert = require('node:assert/strict');
const {load} = require('./helpers.cjs');
const jwt = require('jsonwebtoken');
const {verifyInsightsAdmin} = load('auth');
const {getInsightsMode, requireDemoMode} = load('config');
const {parseInsightFilters, insightWindow} = load('filters');
const id = '10000000-0000-4000-8000-000000000001';
const secret = 'synthetic-secret-for-tests-only';
test('admin authorization requires a valid session and current database role', async () => {
  let lookups = 0;
  const lookup = async () => {lookups++;return {id,nivel:'admin'};};
  await assert.rejects(verifyInsightsAdmin(undefined,lookup,secret),e=>e.status===401);
  await assert.rejects(verifyInsightsAdmin('invalid',lookup,secret),e=>e.status===401);
  await assert.rejects(verifyInsightsAdmin(jwt.sign({userId:id},secret,{expiresIn:-1}),lookup,secret),e=>e.status===401);
  assert.equal(lookups,0);
  const token=jwt.sign({userId:id,nivel:'admin'},secret,{expiresIn:60});
  await verifyInsightsAdmin(token,lookup,secret);
  await assert.rejects(verifyInsightsAdmin(token,async()=>({id,nivel:'user'}),secret),e=>e.status===403);
  await assert.rejects(verifyInsightsAdmin(token,async()=>null,secret),e=>e.status===403);
  await assert.rejects(verifyInsightsAdmin(token,async()=>{throw new Error('lookup unavailable');},secret),e=>e.status===503);
  await assert.rejects(verifyInsightsAdmin(token,lookup,''),e=>e.status===503);
  await assert.rejects(verifyInsightsAdmin(jwt.sign({userId:id},secret,{algorithm:'HS384'}),lookup,secret),e=>e.status===401);
});
test('feature is off by default; a key does not enable it; demo cannot run in production', () => {
  assert.equal(getInsightsMode({OPENAI_API_KEY:'synthetic'}),'disabled');
  assert.throws(()=>requireDemoMode({}),e=>e.status===503);
  assert.equal(getInsightsMode({INSIGHTS_MODE:'demo',NODE_ENV:'development'}),'demo');
  assert.throws(()=>getInsightsMode({INSIGHTS_MODE:'demo',NODE_ENV:'production'}),e=>e.status===503);
  assert.throws(()=>requireDemoMode({INSIGHTS_MODE:'live'}),e=>e.status===503);
});
test('filters reject arbitrary scope, duplicate values, SQL and arbitrary day counts', () => {
  assert.deepEqual(parseInsightFilters(new URLSearchParams()),{days:30,agentType:'all'});
  for(const invalid of ['days=365','agentType=unknown','userId=123','days=30&days=7','topicId=select%20*%20from%20users'])
    assert.throws(()=>parseInsightFilters(new URLSearchParams(invalid)),e=>e.status===400);
  const window=insightWindow(30,new Date('2026-10-15T01:00:00.000Z'));
  assert.equal(window.timezone,'America/Sao_Paulo');
  assert.equal(window.end,'2026-10-15T01:00:00.000Z');
  assert.ok(window.start<window.end);
});
