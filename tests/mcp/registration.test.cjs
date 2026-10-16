require('../insights/helpers.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const cfg=require('../../src/lib/insights-mcp/oauth-config.ts'),core=require('../../src/lib/insights-mcp/oauth.ts');
const registration=require('../../src/lib/insights-mcp/oauth-registration.ts');
const env={INSIGHTS_MCP_ENABLED:'true',INSIGHTS_MCP_BASE_URL:'https://example.invalid',INSIGHTS_MCP_CONSENT_SECRET:'synthetic-consent-key-for-public-registration-only',JWT_SECRET:'different-session-signing-key',INSIGHTS_MCP_CLIENTS_JSON:'[]'};
const config=cfg.getOAuthConfig(env),callback='https://claude.ai/api/mcp/auth_callback',chatgpt='https://chatgpt.com/connector_platform_oauth_redirect';
const metadata=(redirect=callback)=>({redirect_uris:[redirect],token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code'],scope:'insights:read'});
const register=(redirect)=>registration.registerOAuthClient(metadata(redirect),config);
const verifier='a'.repeat(64),challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
const authorization=(client)=>new URLSearchParams({client_id:client.client_id,redirect_uri:client.redirect_uris[0],response_type:'code',code_challenge:challenge,code_challenge_method:'S256',state:'x'.repeat(1024),scope:'insights:read',resource:config.resource});
test('DCR works without static clients, creates isolated public installations and fixed platform identity',()=>{
 for(const uri of [callback,'https://claude.com/api/mcp/auth_callback',chatgpt]) {
  const client=register(uri),other=register(uri);assert.notEqual(client.client_id,other.client_id);assert.equal(client.token_endpoint_auth_method,'none');assert.equal(client.client_secret,undefined);assert.ok(client.client_id.length<200);
  assert.equal(registration.resolveOAuthClient(client.client_id,config).redirectUris[0],uri);
  const signed=core.signConsent({request:core.validateAuthorizationRequest(authorization(client),config),userId:'synthetic-admin',nonce:core.randomCredential(),expiresAt:Date.now()+60000,clientName:'forged'},config.consentSecret);
  assert.ok(signed.length<3800);assert.equal(core.verifyConsent(signed,'synthetic-admin',config).clientName,uri===chatgpt?'ChatGPT':'Claude');
  assert.equal(core.authenticateClient(new URLSearchParams({client_id:client.client_id}),null,config),client.client_id);
  for(const secret of ['', 'arbitrary-secret']) assert.throws(()=>core.authenticateClient(new URLSearchParams({client_id:client.client_id,client_secret:secret}),null,config));
  assert.throws(()=>core.authenticateClient(new URLSearchParams({client_id:client.client_id}),'Basic '+Buffer.from(client.client_id+':').toString('base64'),config));
 }
});
test('DCR prevents redirect abuse, scope escalation, client-auth downgrade and metadata SSRF',()=>{
 for(const uri of ['https://evil.invalid/','http://claude.ai/api/mcp/auth_callback',callback+'/',callback+'?q=1',callback+'#x','https://claude.ai.evil.invalid/api/mcp/auth_callback','https://user@claude.ai/api/mcp/auth_callback','https://127.0.0.1/callback','https://chatgpt.com/connector/oauth/random']) assert.throws(()=>registration.registerOAuthClient(metadata(uri),config));
 for(const patch of [{redirect_uris:[]},{redirect_uris:[callback,callback]},{redirect_uris:[callback,chatgpt]},{token_endpoint_auth_method:'client_secret_post'},{grant_types:['client_credentials']},{grant_types:[]},{response_types:['token']},{scope:'insights:read write'},{application_type:'native'},{jwks_uri:'https://127.0.0.1/'},{request_uris:['https://evil.invalid']},{software_statement:'untrusted'},{client_secret:'spoof'}]) assert.throws(()=>registration.registerOAuthClient({...metadata(),...patch},config));
 const client=register(),p=authorization(client);p.set('redirect_uri',chatgpt);assert.throws(()=>core.validateAuthorizationRequest(p,config));p.set('redirect_uri',callback);p.set('code_challenge_method','plain');assert.throws(()=>core.validateAuthorizationRequest(p,config));
});
test('Signed client metadata rejects tampering, oversized IDs, issuer replay and signing key changes',()=>{
 const client=register(),parts=client.client_id.split('.');parts[1]=Buffer.from(JSON.stringify({r:[2],n:'A'.repeat(22)})).toString('base64url');
 for(const id of [parts.join('.'),client.client_id+'x','dcr1.'+'x'.repeat(600), 'unknown']) assert.equal(registration.resolveOAuthClient(id,config),undefined);
 assert.equal(registration.resolveOAuthClient(client.client_id,{...config,issuer:'https://other.invalid'}),undefined);
 assert.equal(registration.resolveOAuthClient(client.client_id,{...config,consentSecret:'another-independent-secret'}),undefined);
});
Object.assign(process.env,env);
const admin='10000000-0000-4000-8000-000000000001';let level='admin',cookies={},calls=[],boundClient='',boundChallenge='',boundRedirect='';
const db={rpc:async(_name,args)=>{calls.push(args);const p=args.p_data;if(args.p_operation==='exchange'&&(p.client_id!==boundClient||p.challenge!==boundChallenge||p.redirect_uri!==boundRedirect))return{data:null,error:null};if(['refresh','revoke'].includes(args.p_operation)&&p.client_id!==boundClient)return{data:args.p_operation==='revoke'?{}:null,error:null};return{data:{user_id:admin},error:null};},from(table){const q={select(){return q;},eq(){return q;},async maybeSingle(){return{error:null,data:table==='users'?{id:admin,nivel:level}:table==='insights_mcp_oauth_tokens'?{grant_id:'grant',access_expires_at:new Date(Date.now()+60000).toISOString()}:{user_id:admin,client_id:boundClient,resource:config.resource,scope:'insights:read',revoked_at:null}};}};return q;}};
const orig=Module._load;Module._load=function(request,parent,isMain){if(request==='next/headers')return{cookies:async()=>({get:key=>cookies[key]?{value:cookies[key]}:undefined})};if(request==='../supabase/server'&&parent?.filename.endsWith('oauth-server.ts'))return{createServerSupabaseClient:()=>db};return orig.call(this,request,parent,isMain);};
const server=require('../../src/lib/insights-mcp/oauth-server.ts'),jwt=require('jsonwebtoken');
const form=(data)=>new Request(config.issuer+'/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data)});
test('Registration HTTP is bounded JSON, no-store, disabled fail-closed and rejects untrusted metadata',async()=>{
 const request=(body,type='application/json')=>new Request(config.issuer+'/oauth/register',{method:'POST',headers:{'content-type':type},body});
 let r=await server.registerPost(request(JSON.stringify(metadata())));assert.equal(r.status,201);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).client_secret,undefined);
 for(const [body,type,status]of [['{','application/json',400],['{}','text/plain',415],['x'.repeat(4097),'application/json',413],[JSON.stringify(metadata('https://evil.invalid')),'application/json',400]]){r=await server.registerPost(request(body,type));assert.equal(r.status,status);}
 process.env.INSIGHTS_MCP_ENABLED='false';assert.equal((await server.registerPost(request(JSON.stringify(metadata())))).status,503);process.env.INSIGHTS_MCP_ENABLED='true';assert.equal(calls.length,0);
});
test('DCR authorization still needs an administrator and consent; exchange, refresh, revoke bind public installation',async()=>{
 const client=register(),other=register();boundClient=client.client_id;boundChallenge=challenge;boundRedirect=callback;
 cookies={};let r=await server.authorizeGet(new Request(config.issuer+'/oauth/authorize?'+authorization(client)));assert.equal(r.status,303);assert.match(r.headers.get('location'),/auth\/login/);assert.equal(calls.length,0);
 cookies.auth_token=jwt.sign({userId:admin},env.JWT_SECRET);level='user';r=await server.authorizeGet(new Request(config.issuer+'/oauth/authorize?'+authorization(client)));assert.equal(r.status,403);assert.equal(calls.length,0);level='admin';
 r=await server.authorizeGet(new Request(config.issuer+'/oauth/authorize?'+authorization(client)));assert.equal(r.status,303);assert.equal(calls.at(-1).p_operation,'consent');
 const common={client_id:client.client_id,resource:config.resource,grant_type:'authorization_code',code:core.randomCredential(),redirect_uri:callback,code_verifier:verifier};
 assert.equal((await server.tokenPost(form(common))).status,200);
 assert.equal((await server.tokenPost(form({...common,client_id:other.client_id}))).status,400);
 assert.equal((await server.tokenPost(form({...common,code_verifier:'b'.repeat(64)}))).status,400);
 assert.equal((await server.tokenPost(form({...common,client_secret:''}))).status,401);
 assert.equal((await server.tokenPost(form({client_id:client.client_id,resource:config.resource,grant_type:'refresh_token',refresh_token:core.randomCredential()}))).status,200);
 assert.equal((await server.tokenPost(form({client_id:other.client_id,resource:config.resource,grant_type:'refresh_token',refresh_token:core.randomCredential()}))).status,400);
 assert.equal((await server.revokePost(form({client_id:client.client_id,token:core.randomCredential()}))).status,200);assert.equal(calls.at(-1).p_data.client_id,client.client_id);
 const bearer=new Request(config.resource,{headers:{authorization:'Bearer '+core.randomCredential()}});assert.equal((await server.authenticateMcpRequest(bearer)).clientId,client.client_id);level='user';await assert.rejects(()=>server.authenticateMcpRequest(bearer),e=>e.status===403);level='admin';
});
