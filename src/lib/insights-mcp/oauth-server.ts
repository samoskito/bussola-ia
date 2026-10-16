import { cookies } from 'next/headers';
import * as jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import { createServerSupabaseClient } from '../supabase/server';
import { getOAuthConfig, OAuthError, MCP_SCOPE } from './oauth-config';
import { ACCESS_SECONDS, CONSENT_SECONDS, AuthorizationConsent, authenticateClient, equalSecret, randomCredential, signConsent, tokenHash, uniqueParams, validateAuthorizationRequest, verifyConsent } from './oauth';

import { registerOAuthClient, resolveOAuthClient } from './oauth-registration';

export const CONSENT_COOKIE = 'insights_mcp_consent';
const headers = { 'Cache-Control':'no-store', Pragma:'no-cache', 'Referrer-Policy':'no-referrer' };
export function mcpAuthErrorResponse(error: unknown): Response {
  const status = error instanceof OAuthError ? error.status : 503;
  const code = error instanceof OAuthError ? error.code : 'temporarily_unavailable';
  const responseHeaders: Record<string,string> = {...headers};
  if (status === 401) {
    if (code==='invalid_client') responseHeaders['WWW-Authenticate']='Basic realm="insights-mcp-token"';
    else try { responseHeaders['WWW-Authenticate'] = `Bearer resource_metadata="${getOAuthConfig().protectedResourceMetadataUrl}", error="invalid_token"`; } catch { /* Disabled configurations never advertise a usable endpoint. */ }
  }
  return Response.json({error:code}, {status,headers:responseHeaders});
}
async function dbMutation(operation: string, data: Record<string, unknown>) {
  const { data: result, error } = await createServerSupabaseClient().rpc('insights_mcp_oauth_mutate',{p_operation:operation,p_data:data});
  if (error) throw new OAuthError(503,'temporarily_unavailable');
  return result;
}
export async function assertCurrentAdmin(userId: string) {
  const {data,error} = await createServerSupabaseClient().from('users').select('id,nivel').eq('id',userId).maybeSingle();
  if (error) throw new OAuthError(503,'temporarily_unavailable');
  if (!data || data.id!==userId || data.nivel!=='admin') throw new OAuthError(403,'access_denied');
}
export async function requireMcpSessionAdmin(): Promise<string> {
  getOAuthConfig();
  const secret=process.env.JWT_SECRET;
  if (!secret) throw new OAuthError(503,'temporarily_unavailable');
  let userId:string;
  try {
    const token=(await cookies()).get('auth_token')?.value;
    if (!token) throw new Error();
    const payload=jwt.verify(token,secret,{algorithms:['HS256']});
    if (typeof payload==='string' || typeof payload.userId!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(payload.userId)) throw new Error();
    userId=payload.userId;
  } catch { throw new OAuthError(401,'login_required'); }
  await assertCurrentAdmin(userId); return userId;
}
export function readConsent(ticket:string|undefined,userId:string):AuthorizationConsent { return verifyConsent(ticket,userId,getOAuthConfig()); }
export async function authorizeGet(request:Request):Promise<Response> {
  try {
    const config=getOAuthConfig(); const url=new URL(request.url);
    const validated=validateAuthorizationRequest(url.searchParams,config);
    let userId:string;
    try {userId=await requireMcpSessionAdmin();} catch(error) {
      if (!(error instanceof OAuthError) || error.status!==401) throw error;
      const login=new URL('/auth/login',config.issuer);login.searchParams.set('redirectedFrom',url.pathname+url.search);
      return Response.redirect(login,303);
    }
    const consent:AuthorizationConsent={request:validated,userId,nonce:randomCredential(),expiresAt:Date.now()+CONSENT_SECONDS*1000,clientName:resolveOAuthClient(validated.clientId,config)!.name};
    if (await dbMutation('consent',{nonce_hash:tokenHash(consent.nonce),user_id:userId})===null) throw new OAuthError(403,'access_denied');
    const ticket=signConsent(consent,config.consentSecret);
    return new Response(null,{status:303,headers:{...headers,Location:`${config.issuer}/auth/insights-mcp`,'Set-Cookie':`${CONSENT_COOKIE}=${ticket}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${CONSENT_SECONDS}`}});
  } catch(error) {return mcpAuthErrorResponse(error);}
}
async function readForm(request:Request) {
  if ((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/x-www-form-urlencoded') throw new OAuthError(415,'invalid_request');
  // Bound streamed bytes before decoding; Content-Length may be absent or forged.
  const reader=request.body?.getReader(); let size=0; const chunks:Uint8Array[]=[];
  if (reader) for (;;) { const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>16384){await reader.cancel();throw new OAuthError(413,'invalid_request');}chunks.push(next.value); }
  const params=new URLSearchParams(Buffer.concat(chunks).toString());uniqueParams(params);return params;
}
export async function authorizePost(request:Request):Promise<Response> {
  try {
    const config=getOAuthConfig();if(request.headers.get('origin')!==config.issuer)throw new OAuthError(403,'access_denied');
    const userId=await requireMcpSessionAdmin();const cookieStore=await cookies();const consent=readConsent(cookieStore.get(CONSENT_COOKIE)?.value,userId);
    const form=await readForm(request);if(!equalSecret(form.get('csrf')||'',consent.nonce))throw new OAuthError(403,'access_denied');
    const decision=form.get('decision');if(decision!=='approve' && decision!=='deny')throw new OAuthError(400,'invalid_request');
    const code=randomCredential();const r=consent.request;
    const result=await dbMutation(decision==='approve'?'authorize':'deny',{nonce_hash:tokenHash(consent.nonce),user_id:userId,grant_id:randomUUID(),client_id:r.clientId,resource:r.resource,redirect_uri:r.redirectUri,challenge:r.codeChallenge,code_hash:tokenHash(code)});
    if(result===null)throw new OAuthError(400,'invalid_request');
    const redirect=new URL(r.redirectUri);redirect.searchParams.set('state',r.state);redirect.searchParams.set('iss',config.issuer);redirect.searchParams.set(decision==='approve'?'code':'error',decision==='approve'?code:'access_denied');
    return new Response(null,{status:303,headers:{...headers,Location:redirect.href,'Set-Cookie':`${CONSENT_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}});
  }catch(error){return mcpAuthErrorResponse(error);}
}
export async function tokenPost(request:Request):Promise<Response> {
  try {
    const config=getOAuthConfig();const form=await readForm(request);const clientId=authenticateClient(form,request.headers.get('authorization'),config);
    if(form.get('resource')!==config.resource)throw new OAuthError(400,'invalid_target');
    if(form.has('scope') && form.get('scope')!==MCP_SCOPE)throw new OAuthError(400,'invalid_scope');
    const access=randomCredential(),refresh=randomCredential();
    const common={client_id:clientId,resource:config.resource,access_hash:tokenHash(access),new_refresh_hash:tokenHash(refresh)};
    let result;
    if(form.get('grant_type')==='authorization_code') {
      const code=form.get('code')||'',verifier=form.get('code_verifier')||'',redirect=form.get('redirect_uri')||'';
      if(!/^[A-Za-z0-9_-]{43}$/.test(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || !resolveOAuthClient(clientId,config)!.redirectUris.includes(redirect))throw new OAuthError(400,'invalid_grant');
      result=await dbMutation('exchange',{...common,code_hash:tokenHash(code),redirect_uri:redirect,challenge:createHash('sha256').update(verifier).digest('base64url')});
    }else if(form.get('grant_type')==='refresh_token'){
      const token=form.get('refresh_token')||'';if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new OAuthError(400,'invalid_grant');
      result=await dbMutation('refresh',{...common,refresh_hash:tokenHash(token)});
    }else throw new OAuthError(400,'unsupported_grant_type');
    if(result===null)throw new OAuthError(400,'invalid_grant');
    return Response.json({access_token:access,token_type:'Bearer',expires_in:ACCESS_SECONDS,refresh_token:refresh,scope:MCP_SCOPE},{headers});
  }catch(error){return mcpAuthErrorResponse(error);}
}
export async function revokePost(request:Request):Promise<Response> {
  try {
    const config=getOAuthConfig();const form=await readForm(request);const clientId=authenticateClient(form,request.headers.get('authorization'),config);
    const token=form.get('token')||'';if(!token || token.length>1024)throw new OAuthError(400,'invalid_request');
    await dbMutation('revoke',{client_id:clientId,token_hash:tokenHash(token)});return new Response(null,{status:200,headers});
  }catch(error){return mcpAuthErrorResponse(error);}
}
export async function authenticateMcpRequest(request:Request):Promise<{userId:string;clientId:string;scope:string}> {
  const config=getOAuthConfig();const authorization=request.headers.get('authorization')||'';
  if(!/^Bearer [A-Za-z0-9_-]{43}$/i.test(authorization))throw new OAuthError(401,'invalid_token');
  const {data:token,error}=await createServerSupabaseClient().from('insights_mcp_oauth_tokens').select('grant_id,access_expires_at').eq('access_hash',tokenHash(authorization.slice(7))).maybeSingle();
  if(error)throw new OAuthError(503,'temporarily_unavailable');
  if(!token || new Date(token.access_expires_at).getTime()<=Date.now())throw new OAuthError(401,'invalid_token');
  const {data:grant,error:grantError}=await createServerSupabaseClient().from('insights_mcp_oauth_grants').select('user_id,client_id,resource,scope,revoked_at').eq('id',token.grant_id).maybeSingle();
  if(grantError)throw new OAuthError(503,'temporarily_unavailable');
  if(!grant || grant.revoked_at || grant.resource!==config.resource || grant.scope!==MCP_SCOPE || !resolveOAuthClient(grant.client_id,config))throw new OAuthError(401,'invalid_token');
  await assertCurrentAdmin(grant.user_id);return{userId:grant.user_id,clientId:grant.client_id,scope:grant.scope};
}

export async function registerPost(request: Request): Promise<Response> {
  try {
    const config = getOAuthConfig();
    if ((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') throw new OAuthError(415, 'invalid_request');
    const reader = request.body?.getReader(); let size = 0; const chunks: Uint8Array[] = [];
    if (reader) for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 4096) { await reader.cancel(); throw new OAuthError(413, 'invalid_request'); } chunks.push(next.value); }
    let metadata: unknown;
    try { metadata = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new OAuthError(400, 'invalid_client_metadata'); }
    return Response.json(registerOAuthClient(metadata, config), { status: 201, headers });
  } catch (error) { return mcpAuthErrorResponse(error); }
}
