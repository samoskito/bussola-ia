require('../insights/helpers.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const cfg=require('../../src/lib/insights-mcp/oauth-config.ts'),core=require('../../src/lib/insights-mcp/oauth.ts');
const registration=require('../../src/lib/insights-mcp/oauth-registration.ts');
const env={INSIGHTS_MCP_ENABLED:'true',INSIGHTS_MCP_BASE_URL:'https://example.invalid',INSIGHTS_MCP_CONSENT_SECRET:'synthetic-consent-key-for-loopback-registration',JWT_SECRET:'different-session-signing-key',INSIGHTS_MCP_CLIENTS_JSON:'[]'};
const config=cfg.getOAuthConfig(env);
// Shape sent by the MCP TypeScript SDK used by Claude Code (native app, ephemeral port).
const claudeCode=(redirect='http://localhost:53682/callback',extra={})=>({client_name:'Claude Code (bussola)',redirect_uris:[redirect],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none',...extra});
const verifier='v'.repeat(64),challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
const authorization=(clientId,redirect)=>new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',code_challenge:challenge,code_challenge_method:'S256',state:'s'.repeat(43),scope:'insights:read',resource:config.resource});

test('Claude Code loopback registration is accepted as a public native installation for the three loopback hosts',()=>{
 for(const uri of ['http://localhost:53682/callback','http://127.0.0.1:1/callback','http://[::1]:65535/callback','http://localhost/callback','http://127.0.0.1:8080/oauth/callback']){
  const client=registration.registerOAuthClient(claudeCode(uri),config);
  assert.equal(client.token_endpoint_auth_method,'none');assert.equal(client.client_secret,undefined);assert.equal(client.application_type,'native');
  assert.deepEqual(client.redirect_uris,[uri]);assert.ok(client.client_id.startsWith('dcr3.'));assert.ok(client.client_id.length<200);
  const resolved=registration.resolveOAuthClient(client.client_id,config);
  assert.equal(resolved.loopback,true);assert.equal(resolved.tokenEndpointAuthMethod,'none');assert.equal(resolved.clientSecretHash,undefined);
  assert.equal(resolved.name,registration.LOOPBACK_CLIENT_NAME);
  assert.equal(core.authenticateClient(new URLSearchParams({client_id:client.client_id}),null,config),client.client_id);
 }
 // Both loopback spellings in one installation, and SDK variants (no method, native/web type, scope).
 const both=registration.registerOAuthClient(claudeCode('http://localhost:1234/callback',{redirect_uris:['http://localhost:1234/callback','http://127.0.0.1:1234/callback']}),config);
 assert.equal(registration.resolveOAuthClient(both.client_id,config).redirectUris.length,2);
 for(const extra of [{token_endpoint_auth_method:undefined},{application_type:'native'},{application_type:'web'},{scope:'insights:read'},{client_uri:'https://claude.com',software_id:'claude-code',software_version:'2.0.0'}])
  assert.equal(registration.registerOAuthClient(claudeCode(undefined,extra),config).token_endpoint_auth_method,'none');
});

test('A secret method requested by a loopback client is replaced by none; any later secret is refused',()=>{
 for(const method of ['client_secret_basic','client_secret_post']){
  const client=registration.registerOAuthClient(claudeCode(undefined,{token_endpoint_auth_method:method}),config);
  assert.equal(client.token_endpoint_auth_method,'none');assert.equal(client.client_secret,undefined);
  assert.throws(()=>core.authenticateClient(new URLSearchParams({client_id:client.client_id,client_secret:'x'.repeat(43)}),null,config),e=>e.code==='invalid_client');
  assert.throws(()=>core.authenticateClient(new URLSearchParams(),'Basic '+Buffer.from(client.client_id+':'+'x'.repeat(43)).toString('base64'),config),e=>e.code==='invalid_client');
 }
 for(const method of ['private_key_jwt',null,'tls_client_auth']) assert.throws(()=>registration.registerOAuthClient(claudeCode(undefined,{token_endpoint_auth_method:method}),config),e=>e.code==='invalid_client_metadata');
});

test('Loopback authorization ignores only the port; scheme, host and path must match the registration',()=>{
 const client=registration.registerOAuthClient(claudeCode('http://localhost:53682/callback'),config);
 for(const uri of ['http://localhost:53682/callback','http://localhost:49152/callback','http://localhost:1/callback','http://localhost/callback'])
  assert.equal(core.validateAuthorizationRequest(authorization(client.client_id,uri),config).redirectUri,uri);
 for(const uri of ['http://127.0.0.1:53682/callback','http://[::1]:53682/callback','https://localhost:53682/callback','http://localhost:53682/callback/','http://localhost:53682/other',
   'http://localhost:53682/callback?x=1','http://localhost:53682/callback#x','http://user@localhost:53682/callback','http://LOCALHOST:53682/callback','http://localhost:0/callback',
   'http://localhost:53682/a/../callback','http://localhost.evil.com:53682/callback','http://127.0.0.1.nip.io:53682/callback','http://localhost:53682/%63allback'])
  assert.throws(()=>core.validateAuthorizationRequest(authorization(client.client_id,uri),config),uri);
 const p=authorization(client.client_id,'http://localhost:1/callback');p.set('code_challenge_method','plain');assert.throws(()=>core.validateAuthorizationRequest(p,config));
 // Hosted clients keep exact matching; a port never relaxes HTTPS callbacks.
 const hosted=registration.registerOAuthClient({redirect_uris:['https://claude.ai/api/mcp/auth_callback'],token_endpoint_auth_method:'none'},config);
 assert.throws(()=>core.validateAuthorizationRequest(authorization(hosted.client_id,'https://claude.ai:8443/api/mcp/auth_callback'),config));
 assert.throws(()=>core.validateAuthorizationRequest(authorization(hosted.client_id,'http://localhost:1/callback'),config));
});

test('Loopback registration rejects lookalike hosts, non-loopback http, userinfo, query, fragment and mixing',()=>{
 for(const uri of ['http://localhost.evil.com:1234/callback','http://127.0.0.1.nip.io:1234/callback','http://evil.com/callback','http://10.0.0.1:1234/callback','http://127.0.0.2:1234/callback',
   'http://0.0.0.0:1234/callback','http://[::2]:1234/callback','http://user@localhost:1234/callback','http://user:pw@127.0.0.1:1234/callback','http://localhost:1234@evil.com/callback',
   'http://localhost:1234/callback?x=1','http://localhost:1234/callback#frag','http://localhost:0/callback','http://localhost:65536/callback','http://LocalHost:1234/callback',
   'http://localhost:01234/callback','http://localhost:80/callback','http://localhost:1234','http://localhost:1234/a/../b','http://localhost:1234/%2e%2e/x','http://localhost:1234/'+'a'.repeat(200),
   'https://localhost:1234/callback','ftp://localhost:1234/callback','localhost:1234/callback','javascript:alert(1)'])
  assert.throws(()=>registration.registerOAuthClient(claudeCode(uri),config),e=>e.code==='invalid_redirect_uri',uri);
 for(const uris of [['http://localhost:1/callback','https://claude.ai/api/mcp/auth_callback'],['http://localhost:1/callback','http://localhost:2/callback'],['http://localhost:1/a','http://127.0.0.1:1/b','http://[::1]:1/c']])
  assert.throws(()=>registration.registerOAuthClient(claudeCode(undefined,{redirect_uris:uris}),config));
 for(const extra of [{scope:'insights:read write'},{grant_types:['client_credentials']},{response_types:['token']},{application_type:'service'},{jwks_uri:'https://127.0.0.1/'},{client_secret:'spoof'},{software_statement:'x'}])
  assert.throws(()=>registration.registerOAuthClient(claudeCode(undefined,extra),config),e=>e.code==='invalid_client_metadata');
});

test('Signed loopback client IDs reject tampering, version confusion and static-client loopback flags',()=>{
 const client=registration.registerOAuthClient(claudeCode(),config),parts=client.client_id.split('.');
 const payload=JSON.parse(Buffer.from(parts[1],'base64url'));
 for(const changed of [{...payload,l:[[0,'/evil']]},{...payload,l:[[3,'/callback']]},{...payload,r:[0]}]){const p=[...parts];p[1]=Buffer.from(JSON.stringify(changed)).toString('base64url');assert.equal(registration.resolveOAuthClient(p.join('.'),config),undefined);}
 for(const version of ['dcr1','dcr2']) assert.equal(registration.resolveOAuthClient([version,parts[1],parts[2]].join('.'),config),undefined);
 assert.equal(registration.resolveOAuthClient(client.client_id,{...config,consentSecret:'another-independent-secret-value-xx'}),undefined);
 assert.equal(registration.resolveOAuthClient(client.client_id,{...config,issuer:'https://other.invalid'}),undefined);
 const hash=crypto.createHash('sha256').update('s'.repeat(40)).digest('hex');
 assert.throws(()=>cfg.getOAuthConfig({...env,INSIGHTS_MCP_CLIENTS_JSON:JSON.stringify([{clientId:'static-x',name:'x',clientSecretHash:hash,redirectUris:['https://example.invalid/cb'],loopback:true}])}));
 assert.equal(cfg.getOAuthConfig({...env,INSIGHTS_MCP_CLIENTS_JSON:JSON.stringify([{clientId:'static-x',name:'x',clientSecretHash:hash,redirectUris:['https://example.invalid/cb']}])}).clients.length,1);
});

Object.assign(process.env,env);
const admin='10000000-0000-4000-8000-000000000001';let cookies={},calls=[],bound={};
const db={rpc:async(_name,args)=>{calls.push(args);const p=args.p_data;if(args.p_operation==='exchange'&&(p.client_id!==bound.client||p.challenge!==bound.challenge||p.redirect_uri!==bound.redirect))return{data:null,error:null};return{data:{user_id:admin},error:null};},
 from(table){const q={select(){return q;},eq(){return q;},async maybeSingle(){return{error:null,data:table==='users'?{id:admin,nivel:'admin'}:null};}};return q;}};
const orig=Module._load;Module._load=function(request,parent,isMain){if(request==='next/headers')return{cookies:async()=>({get:key=>cookies[key]?{value:cookies[key]}:undefined})};if(request==='../supabase/server'&&parent?.filename.endsWith('oauth-server.ts'))return{createServerSupabaseClient:()=>db};return orig.call(this,request,parent,isMain);};
const server=require('../../src/lib/insights-mcp/oauth-server.ts'),jwt=require('jsonwebtoken');
const form=(data,headers={})=>new Request(config.issuer+'/api/insights-mcp/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams(data)});

test('Full loopback flow over HTTP: register, consent 303 to http://localhost with code, PKCE-bound exchange on the same port',async()=>{
 let r=await server.registerPost(new Request(config.issuer+'/api/insights-mcp/oauth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(claudeCode('http://localhost:53682/callback'))}));
 assert.equal(r.status,201);const client=await r.json();assert.equal(client.token_endpoint_auth_method,'none');
 const redirect='http://localhost:61000/callback';
 cookies={auth_token:jwt.sign({userId:admin},env.JWT_SECRET)};
 r=await server.authorizeGet(new Request(config.issuer+'/api/insights-mcp/oauth/authorize?'+authorization(client.client_id,redirect)));
 assert.equal(r.status,303);assert.equal(r.headers.get('location'),config.issuer+'/auth/insights-mcp');
 cookies.insights_mcp_consent=r.headers.get('set-cookie').split(';')[0].split('=').slice(1).join('=');
 const consent=server.readConsent(cookies.insights_mcp_consent,admin);assert.equal(consent.request.redirectUri,redirect);assert.equal(consent.clientName,registration.LOOPBACK_CLIENT_NAME);
 const post=new Request(config.issuer+'/api/insights-mcp/oauth/authorize',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:config.issuer},body:new URLSearchParams({csrf:consent.nonce,decision:'approve'})});
 r=await server.authorizePost(post);assert.equal(r.status,303);
 const location=new URL(r.headers.get('location'));assert.equal(location.origin+location.pathname,redirect);assert.equal(location.searchParams.get('iss'),config.issuer);
 assert.equal(location.searchParams.get('state'),'s'.repeat(43));assert.match(location.searchParams.get('code'),/^[A-Za-z0-9_-]{43}$/);
 assert.equal(calls.at(-1).p_data.redirect_uri,redirect,'the exact port used is stored for the exchange');
 // Origin and CSRF stay mandatory on the native-app path.
 assert.equal((await server.authorizePost(new Request(post.url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:'http://localhost:61000'},body:new URLSearchParams({csrf:consent.nonce,decision:'approve'})}))).status,403);
 bound={client:client.client_id,challenge,redirect};
 const common={client_id:client.client_id,resource:config.resource,grant_type:'authorization_code',code:location.searchParams.get('code'),redirect_uri:redirect,code_verifier:verifier};
 assert.equal((await server.tokenPost(form(common))).status,200);
 assert.equal((await server.tokenPost(form({...common,redirect_uri:'http://localhost:61001/callback'}))).status,400,'database binding keeps the authorized port exact');
 assert.equal((await server.tokenPost(form({...common,redirect_uri:'http://127.0.0.1:61000/callback'}))).status,400);
 assert.equal((await server.tokenPost(form({...common,code_verifier:'w'.repeat(64)}))).status,400);
 assert.equal((await server.tokenPost(form({...common,client_secret:'x'.repeat(43)}))).status,401);
 assert.equal((await server.tokenPost(form({client_id:client.client_id,resource:config.resource,grant_type:'refresh_token',refresh_token:core.randomCredential()}))).status,200);
 assert.equal((await server.revokePost(form({client_id:client.client_id,token:core.randomCredential()}))).status,200);
});
