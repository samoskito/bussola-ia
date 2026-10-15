require('../insights/helpers.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const cfg=require('../../src/lib/insights-mcp/oauth-config.ts'),core=require('../../src/lib/insights-mcp/oauth.ts');
const secret='oauth-client-secret-only-for-synthetic-testing-111',sessionSecret='session-only-for-synthetic-tests-222',consentSecret='consent-only-for-synthetic-tests-333';
const env={INSIGHTS_MCP_ENABLED:'true',INSIGHTS_MCP_BASE_URL:'https://example.invalid',INSIGHTS_MCP_CONSENT_SECRET:consentSecret,JWT_SECRET:sessionSecret,INSIGHTS_MCP_CLIENTS_JSON:JSON.stringify([{clientId:'claude',name:'Claude',clientSecretHash:core.tokenHash(secret),redirectUris:['https://claude.ai/api/mcp/auth_callback']}])};
const config=cfg.getOAuthConfig(env),verifier='a'.repeat(64),challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
const params=()=>new URLSearchParams({client_id:'claude',redirect_uri:'https://claude.ai/api/mcp/auth_callback',response_type:'code',code_challenge_method:'S256',code_challenge:challenge,resource:config.resource,scope:'insights:read',state:'opaque-client-state'});
test('OAuth disabled by default; independent secret and HTTPS origin required',()=>{
 assert.equal(cfg.isMcpEnabled({}),false);assert.throws(()=>cfg.getOAuthConfig({}),/disabled/);
 for(const patch of [{INSIGHTS_MCP_BASE_URL:'http://example.invalid'},{INSIGHTS_MCP_BASE_URL:'https://example.invalid/path'},{INSIGHTS_MCP_CONSENT_SECRET:sessionSecret},{INSIGHTS_CRON_SECRET:consentSecret},{INSIGHTS_MCP_CLIENTS_JSON:'[]'}]) assert.throws(()=>cfg.getOAuthConfig({...env,...patch}));
 const reused=JSON.parse(env.INSIGHTS_MCP_CLIENTS_JSON);reused[0].clientSecretHash=core.tokenHash(sessionSecret);assert.throws(()=>cfg.getOAuthConfig({...env,INSIGHTS_MCP_CLIENTS_JSON:JSON.stringify(reused)}));
});
test('Authorize requires registered exact HTTPS redirect, audience, state, S256, scope, unique parameters',()=>{
 assert.equal(core.validateAuthorizationRequest(params(),config).resource,config.resource);
 for(const [key,value]of Object.entries({redirect_uri:'https://claude.ai/api/mcp/auth_callback/evil',client_id:'attacker',resource:'https://evil.invalid',scope:'write',code_challenge_method:'plain',response_type:'token',state:'',code_challenge:'wrong'})){const p=params();p.set(key,value);assert.throws(()=>core.validateAuthorizationRequest(p,config),key);}
 const p=params();p.append('client_id','attacker');assert.throws(()=>core.validateAuthorizationRequest(p,config));
 assert.equal(core.verifyPkce(verifier,challenge),true);assert.equal(core.verifyPkce('b'.repeat(64),challenge),false);assert.equal(core.verifyPkce('short',challenge),false);
});
test('Consent signature binds full request, subject, expiry and random nonce; cookie size bounded',()=>{
 const value={request:core.validateAuthorizationRequest(params(),config),userId:'synthetic-admin',nonce:core.randomCredential(),expiresAt:Date.now()+60000,clientName:'Claude'};
 const ticket=core.signConsent(value,consentSecret);assert.equal(core.verifyConsent(ticket,value.userId,config).nonce,value.nonce);
 assert.throws(()=>core.verifyConsent(ticket,'other-user',config));assert.throws(()=>core.verifyConsent(ticket+'tamper',value.userId,config));assert.throws(()=>core.verifyConsent(ticket,value.userId,config,Date.now()+120000));
 assert.throws(()=>core.signConsent({...value,request:{...value.request,state:'a'.repeat(5000)}},consentSecret),/limit/);
});
test('Confidential clients support basic and post; weak/missing/wrong credentials rejected',()=>{
 assert.equal(core.authenticateClient(new URLSearchParams({client_id:'claude',client_secret:secret}),null,config),'claude');
 assert.equal(core.authenticateClient(new URLSearchParams(),`Basic ${Buffer.from('claude:'+secret).toString('base64')}`,config),'claude');
 for(const s of ['', 'bad', 'x'.repeat(64)]) assert.throws(()=>core.authenticateClient(new URLSearchParams({client_id:'claude',client_secret:s}),null,config));
 assert.throws(()=>core.authenticateClient(new URLSearchParams({client_id:'other'}),`Basic ${Buffer.from('claude:'+secret).toString('base64')}`,config));
});

// Intercept only test dependencies. Never load environment files or allow fetch.
Object.assign(process.env,env);
let cookieValues={},userLevel='admin',lookupFailure=false,grantRevoked=false,resource=config.resource,accessExpiry=new Date(Date.now()+600000).toISOString(),mutations=[];
const id='10000000-0000-4000-8000-000000000001',bearer=core.randomCredential();
const db={rpc:async(op,args)=>{mutations.push(args);return{data:{user_id:id},error:null};},from(table){const q={select(){return q;},eq(){return q;},async maybeSingle(){if(lookupFailure)return{data:null,error:{message:'synthetic failure'}};return{error:null,data:table==='users'?{id,nivel:userLevel}:table==='insights_mcp_oauth_tokens'?{grant_id:'grant',access_expires_at:accessExpiry}:{user_id:id,client_id:'claude',resource,scope:'insights:read',revoked_at:grantRevoked?'2026-01-01':null}};}};return q;}};
const orig=Module._load;Module._load=function(request,parent,isMain){if(request==='next/headers')return{cookies:async()=>({get:key=>cookieValues[key]?{value:cookieValues[key]}:undefined})};if(request==='../supabase/server'&&parent?.filename.endsWith('oauth-server.ts'))return{createServerSupabaseClient:()=>db};return orig.call(this,request,parent,isMain);};
const server=require('../../src/lib/insights-mcp/oauth-server.ts'),jwt=require('jsonwebtoken');
const metadata=require('../../src/lib/insights-mcp/oauth-metadata.ts');
const post=(path,data,extra={})=>new Request(config.issuer+path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',...extra},body:new URLSearchParams(data)});
test('Opaque MCP bearer rejects app JWT/cookies; audience, expiry, revocation and live admin checked',async()=>{
 const valid=()=>new Request(config.resource,{headers:{Authorization:`Bearer ${bearer}`}});
 assert.equal((await server.authenticateMcpRequest(valid())).userId,id);
 await assert.rejects(()=>server.authenticateMcpRequest(new Request(config.resource,{headers:{Cookie:'auth_token=anything'}})));
 await assert.rejects(()=>server.authenticateMcpRequest(new Request(config.resource,{headers:{Authorization:'Bearer '+jwt.sign({userId:id},sessionSecret)}})));
 resource='https://wrong.invalid';await assert.rejects(()=>server.authenticateMcpRequest(valid()));resource=config.resource;
 accessExpiry=new Date(Date.now()-100).toISOString();await assert.rejects(()=>server.authenticateMcpRequest(valid()));accessExpiry=new Date(Date.now()+60000).toISOString();
 grantRevoked=true;await assert.rejects(()=>server.authenticateMcpRequest(valid()));grantRevoked=false;
 userLevel='user';await assert.rejects(()=>server.authenticateMcpRequest(valid()),e=>e.status===403);userLevel='admin';
 lookupFailure=true;await assert.rejects(()=>server.authenticateMcpRequest(valid()),e=>e.status===503);lookupFailure=false;
});
test('Authorize requires session; GET creates consent only; POST requires origin+csrf+decision',async()=>{
 mutations=[];cookieValues={};let r=await server.authorizeGet(new Request(config.issuer+'/api/insights-mcp/oauth/authorize?'+params()));assert.equal(r.status,303);assert.match(r.headers.get('location'),/auth\/login\?redirectedFrom=/);assert.equal(mutations.length,0);
 cookieValues.auth_token=jwt.sign({userId:id},sessionSecret,{expiresIn:60});
 r=await server.authorizeGet(new Request(config.issuer+'/api/insights-mcp/oauth/authorize?'+params()));assert.equal(r.status,303);assert.equal(mutations.at(-1).p_operation,'consent');assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
 cookieValues[server.CONSENT_COOKIE]=r.headers.get('set-cookie').split(';')[0].split('=')[1];const consent=server.readConsent(cookieValues[server.CONSENT_COOKIE],id);
 for(const [data,origin]of [[{csrf:consent.nonce,decision:'approve'},'https://evil.invalid'],[{csrf:'wrong',decision:'approve'},config.issuer],[{csrf:consent.nonce,decision:'maybe'},config.issuer]]){const denied=await server.authorizePost(post('/oauth/authorize',data,{Origin:origin}));assert.ok([400,403].includes(denied.status));}
 r=await server.authorizePost(post('/oauth/authorize',{csrf:consent.nonce,decision:'approve'},{Origin:config.issuer}));assert.equal(r.status,303);assert.equal(mutations.at(-1).p_operation,'authorize');const location=new URL(r.headers.get('location'));assert.equal(location.searchParams.get('state'),'opaque-client-state');assert.ok(location.searchParams.get('code'));assert.equal(location.searchParams.get('iss'),config.issuer);
});
test('Token routes enforce URL form, client credentials, resource and PKCE; output no-store, refresh and revoke',async()=>{
 const common={client_id:'claude',client_secret:secret,resource:config.resource};
 let r=await server.tokenPost(post('/oauth/token',{...common,grant_type:'authorization_code',code:core.randomCredential(),code_verifier:verifier,redirect_uri:'https://claude.ai/api/mcp/auth_callback'}));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).expires_in,600);assert.equal(mutations.at(-1).p_data.challenge,challenge);
 r=await server.tokenPost(post('/oauth/token',{...common,grant_type:'refresh_token',refresh_token:core.randomCredential()}));assert.equal(r.status,200);assert.equal(mutations.at(-1).p_operation,'refresh');
 r=await server.revokePost(post('/oauth/revoke',{...common,token:bearer}));assert.equal(r.status,200);assert.equal(mutations.at(-1).p_data.token_hash,core.tokenHash(bearer));
 for(const patch of [{resource:'https://evil.invalid'},{client_secret:'wrong'},{grant_type:'client_credentials'},{code_verifier:'short'},{redirect_uri:'https://evil.invalid'}]){r=await server.tokenPost(post('/oauth/token',{...common,grant_type:'authorization_code',code:core.randomCredential(),code_verifier:verifier,redirect_uri:'https://claude.ai/api/mcp/auth_callback',...patch}));assert.ok([400,401].includes(r.status));}
 r=await server.tokenPost(new Request(config.issuer+'/oauth/token',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}));assert.equal(r.status,415);
 const error=server.mcpAuthErrorResponse(new cfg.OAuthError(401,'invalid_client'));assert.match(error.headers.get('www-authenticate'),/^Basic/);
 const bearerError=server.mcpAuthErrorResponse(new cfg.OAuthError(401,'invalid_token'));assert.match(bearerError.headers.get('www-authenticate'),/resource_metadata=/);
});
test('RFC metadata publishes fixed audience, code/S256 and static client auth without secrets or unimplemented DCR',async()=>{
 const as=await metadata.authorizationServerMetadata().json(),rs=await metadata.protectedResourceMetadata().json();
 assert.equal(as.issuer,config.issuer);assert.deepEqual(as.code_challenge_methods_supported,['S256']);assert.equal(as.authorization_endpoint,config.issuer+'/api/insights-mcp/oauth/authorize');assert.equal(rs.resource,config.resource);assert.deepEqual(rs.scopes_supported,['insights:read']);assert.equal(as.registration_endpoint,undefined);assert.equal(as.client_id_metadata_document_supported,undefined);
 const serialized=JSON.stringify({as,rs});for(const sensitive of [secret,consentSecret,sessionSecret,core.tokenHash(secret)])assert.ok(!serialized.includes(sensitive));
 process.env.INSIGHTS_MCP_ENABLED='false';assert.equal(metadata.authorizationServerMetadata().status,503);assert.equal(metadata.protectedResourceMetadata().status,503);process.env.INSIGHTS_MCP_ENABLED='true';
});
