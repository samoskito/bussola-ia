require('../insights/helpers.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const cfg=require('../../src/lib/insights-mcp/oauth-config.ts'),core=require('../../src/lib/insights-mcp/oauth.ts');
const sessionSecret='session-only-for-synthetic-tests-222',consentSecret='consent-only-for-synthetic-tests-333';
const env={INSIGHTS_MCP_ENABLED:'true',INSIGHTS_MCP_BASE_URL:'https://example.invalid',INSIGHTS_MCP_CONSENT_SECRET:consentSecret,JWT_SECRET:sessionSecret,INSIGHTS_MCP_CLIENTS_JSON:JSON.stringify([{clientId:'claude',name:'Claude',clientSecretHash:core.tokenHash('oauth-client-secret-only-for-synthetic-testing-111'),redirectUris:['https://claude.ai/api/mcp/auth_callback']}])};
const config=cfg.getOAuthConfig(env);Object.assign(process.env,env);
const challenge=crypto.createHash('sha256').update('a'.repeat(64)).digest('base64url');
const id='10000000-0000-4000-8000-000000000001';
let cookieValues={},consumed=false,ops=[];
const db={rpc:async(op,args)=>{ops.push(args.p_operation);if(args.p_operation==='consent')return{data:{user_id:id},error:null};if(consumed)return{data:null,error:null};consumed=true;return{data:{user_id:id},error:null};},
 from(){const q={select(){return q;},eq(){return q;},async maybeSingle(){return{error:null,data:{id,nivel:'admin'}};}};return q;}};
const orig=Module._load;Module._load=function(request,parent,isMain){if(request==='next/headers')return{cookies:async()=>({get:key=>cookieValues[key]?{value:cookieValues[key]}:undefined})};if(request==='../supabase/server'&&parent?.filename.endsWith('oauth-server.ts'))return{createServerSupabaseClient:()=>db};return orig.call(this,request,parent,isMain);};
const server=require('../../src/lib/insights-mcp/oauth-server.ts'),jwt=require('jsonwebtoken');
const post=(data,origin=config.issuer)=>new Request(config.issuer+'/api/insights-mcp/oauth/authorize',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:origin},body:new URLSearchParams(data)});
async function start(){
 consumed=false;ops=[];cookieValues.auth_token=jwt.sign({userId:id},sessionSecret,{expiresIn:60});
 const p=new URLSearchParams({client_id:'claude',redirect_uri:'https://claude.ai/api/mcp/auth_callback',response_type:'code',code_challenge_method:'S256',code_challenge:challenge,resource:config.resource,scope:'insights:read',state:'st'});
 const r=await server.authorizeGet(new Request(config.issuer+'/api/insights-mcp/oauth/authorize?'+p));assert.equal(r.status,303);
 cookieValues[server.CONSENT_COOKIE]=r.headers.get('set-cookie').split(';')[0].split('=')[1];
 return server.readConsent(cookieValues[server.CONSENT_COOKIE],id);
}
function assertFriendly(r){
 assert.equal(r.status,409);assert.match(r.headers.get('content-type'),/text\/html/);assert.match(r.headers.get('cache-control'),/no-store/);
 assert.equal(r.headers.get('x-frame-options'),'DENY');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 return r.text();
}
test('segundo envio com nonce consumido mostra pagina amigavel sem dados sensiveis',async()=>{
 const consent=await start();
 const first=await server.authorizePost(post({csrf:consent.nonce,decision:'approve'}));assert.equal(first.status,303);
 const second=await server.authorizePost(post({csrf:consent.nonce,decision:'approve'}));
 const html=await assertFriendly(second);
 assert.match(html,/já foi usada ou expirou/);assert.match(html,/não é preciso fazer mais nada/);assert.match(html,/conexão novamente/);
 assert.ok(!html.includes(consent.nonce));assert.ok(!html.includes('claude.ai'));assert.ok(!html.includes('"error"'));
});
test('cookie de consentimento ausente ou invalido mostra pagina amigavel sem tocar o banco',async()=>{
 const consent=await start();ops=[];
 delete cookieValues[server.CONSENT_COOKIE];
 await assertFriendly(await server.authorizePost(post({csrf:consent.nonce,decision:'approve'})));
 cookieValues[server.CONSENT_COOKIE]='adulterado.invalido';
 await assertFriendly(await server.authorizePost(post({csrf:consent.nonce,decision:'approve'})));
 assert.equal(ops.length,0);
});
test('Origin, CSRF, decisao e admin continuam negados como antes (JSON)',async()=>{
 const consent=await start();ops=[];
 for(const [data,origin,status] of [[{csrf:consent.nonce,decision:'approve'},'https://evil.invalid',403],[{csrf:consent.nonce,decision:'approve'},'null',403],[{csrf:'errado',decision:'approve'},config.issuer,403],[{csrf:consent.nonce,decision:'maybe'},config.issuer,400]]){
  const r=await server.authorizePost(post(data,origin));assert.equal(r.status,status);assert.match(r.headers.get('content-type'),/application\/json/);
 }
 assert.equal(ops.length,0);
 delete cookieValues.auth_token;const r=await server.authorizePost(post({csrf:consent.nonce,decision:'approve'}));assert.equal(r.status,401);assert.match(r.headers.get('content-type'),/application\/json/);
});
test('fluxo normal permanece 303 com code e cookie limpo',async()=>{
 const consent=await start();
 const r=await server.authorizePost(post({csrf:consent.nonce,decision:'approve'}));assert.equal(r.status,303);
 assert.ok(new URL(r.headers.get('location')).searchParams.get('code'));assert.match(r.headers.get('set-cookie'),/Max-Age=0/);
 const c2=await start();const d=await server.authorizePost(post({csrf:c2.nonce,decision:'deny'}));assert.equal(d.status,303);assert.equal(new URL(d.headers.get('location')).searchParams.get('error'),'access_denied');
});
