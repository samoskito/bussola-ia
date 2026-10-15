// Diagnostic only: all remote calls are GET, no RPC or mutations.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const names = ['.env.local', '.env.production', '.env'];
const configs = names.filter(n => fs.existsSync(path.join(root, n))).map(name => ({name, env: dotenv.parse(fs.readFileSync(path.join(root, name)))}));
const chosen = configs.find(c => c.env.NEXT_PUBLIC_SUPABASE_URL && c.env.SUPABASE_SERVICE_ROLE_KEY);
const inventory = configs.map(c => ({file:c.name, supabaseUrl:!!c.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey:!!c.env.SUPABASE_SERVICE_ROLE_KEY, jwtSecret:!!c.env.JWT_SECRET, openaiKey:!!c.env.OPENAI_API_KEY, anthropicKey:!!c.env.ANTHROPIC_API_KEY}));
if (!chosen) { console.log(JSON.stringify({configuration:inventory,error:'No complete Supabase server configuration'})); process.exit(1); }
const base = new URL(chosen.env.NEXT_PUBLIC_SUPABASE_URL);
if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co')) throw new Error('Unexpected Supabase host; review configuration before requests');
const key = chosen.env.SUPABASE_SERVICE_ROLE_KEY;
let role = 'unknown';
try {role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role || role;} catch {}
const windowEnd = '2026-10-15T00:03:50.000Z';
const windowStart = '2026-09-15T00:03:50.000Z';
const report = {configuration:inventory,source:chosen.name,sameSupabaseTarget:configs.filter(c=>c.env.NEXT_PUBLIC_SUPABASE_URL).every(c=>c.env.NEXT_PUBLIC_SUPABASE_URL===base.origin),credentialRole:role,window:{start:windowStart,end:windowEnd,timezone:'America/Sao_Paulo',description:'30 rolling days ending at audit start'},tables:{}};
async function get(resource, params={}, options={}) {
 const url = new URL('/rest/v1/'+resource,base);
 for (const [k,v] of Object.entries(params)) url.searchParams.append(k,String(v));
 const res = await fetch(url,{method:'GET',headers:{apikey:key,Authorization:'Bearer '+key,Accept:options.schema?'application/openapi+json':'application/json',...(options.count?{Prefer:'count=exact'}:{})},signal:AbortSignal.timeout(25000)});
 if (!res.ok) {let code='';try {const err=await res.json();code=err.code||'';if(code==='PGRST201')console.log(JSON.stringify({ambiguousRelationshipMetadata:err.details,hint:err.hint}));} catch {}throw new Error('Read failed: HTTP '+res.status+' code '+code+' resource '+resource);}
 return {data:await res.json(),count:res.headers.get('content-range')};
}
async function count(table, filters={}) {const r=await get(table,{select:'id',limit:0,...filters},{count:true});return Number(r.count?.split('/')[1]);}
async function readPages(table,params,cap=20000) {
 const rows=[];
 for(let offset=0;offset<cap;offset+=500) {
  const r=await get(table,{...params,limit:500,offset});rows.push(...r.data);
  if(r.data.length<500)return rows;
 }
 throw new Error('Read cap exceeded; aggregate coverage would be incomplete');
}
async function run() {
 console.log(JSON.stringify({configuration:inventory,source:report.source,sameSupabaseTarget:report.sameSupabaseTarget,credentialRole:role}));
 const schema = await get('',{}, {schema:true});
 const definitions = schema.data.definitions || schema.data.components?.schemas || {};
 for(const table of ['users','chats','scripts','user_agent_access','mensagens','outputs','arquivos','script_insights','insight_jobs','insight_taxonomies']) {
   const def = definitions[table];
   if(!def) {report.tables[table]={exposed:false};continue;}
   report.tables[table]={exposed:true,columns:Object.entries(def.properties||{}).map(([name,p])=>({name,type:p.type,format:p.format,required:(def.required||[]).includes(name),relationship:p.description?.includes('Foreign Key')?p.description:undefined}))};
 }
 const filters={'created_at':'gte.'+windowStart,and:'(created_at.lt.'+windowEnd+')'};
 for(const table of ['users','chats','scripts','user_agent_access']) {
   if(!report.tables[table]?.exposed)continue;
   report.tables[table].total=await count(table);
   if(table==='scripts'||table==='chats') report.tables[table].last30days=await count(table,filters);
 }
 report.scriptsQuality={noInput:await count('scripts',{...filters,input:'is.null'}),emptyInput:await count('scripts',{...filters,input:'eq.'}),noOutput:await count('scripts',{...filters,output:'is.null'}),noChat:await count('scripts',{...filters,chatid:'is.null'})};
 const rows=await readPages('scripts',{...filters,select:'id,user_id,chatid,created_at,input,chats!scripts_chatid_fkey(id,user_id,agent_type,created_at),users!scripts_user_id_fkey(nivel)',order:'id.asc'});
 const buckets=new Map();const allUsers=new Set();const allChats=new Set();const roles={};
 let totalCharacters=0,blank=0,maxCharacters=0,unmatchedChats=0,unmatchedUsers=0,ownerMismatch=0,existingChats=0;
 const lengths=[];const usersByRole=new Map();
 for(const r of rows) {
  const agent=r.chats?.agent_type||'unclassified';
  if(!buckets.has(agent))buckets.set(agent,{messages:0,users:new Set(),chats:new Set(),byUserRole:{}});
  const b=buckets.get(agent);b.messages++;b.users.add(r.user_id);b.chats.add(r.chatid);
  const level=r.users?.nivel||'unknown';roles[level]=(roles[level]||0)+1;b.byUserRole[level]=(b.byUserRole[level]||0)+1;
  if(!usersByRole.has(level))usersByRole.set(level,new Set());usersByRole.get(level).add(r.user_id);
  allUsers.add(r.user_id);allChats.add(r.chatid);
  const len=(r.input||'').length;lengths.push(len);totalCharacters+=len;maxCharacters=Math.max(maxCharacters,len);if(!(r.input||'').trim())blank++;
  if(!r.chats)unmatchedChats++;else {if(r.chats.user_id!==r.user_id)ownerMismatch++;if(r.chats.created_at<windowStart)existingChats++;}
  if(!r.users)unmatchedUsers++;
 }
 lengths.sort((a,b)=>a-b);
 report.activity={observedMessages:rows.length,expectedMessages:report.tables.scripts.last30days,coverageMatches:rows.length===report.tables.scripts.last30days,distinctUsers:allUsers.size,distinctChats:allChats.size,byAgent:Object.fromEntries([...buckets].map(([a,b])=>[a,{messages:b.messages,distinctUsers:b.users.size,distinctChats:b.chats.size,byUserRole:b.byUserRole}])),messagesByUserRole:roles,distinctUsersByRole:Object.fromEntries([...usersByRole].map(([role,ids])=>[role,ids.size])),messagesInChatsCreatedBeforeWindow:existingChats};
 report.scriptsQuality={...report.scriptsQuality,whitespaceOnly:blank,unmatchedChatJoin:unmatchedChats,unmatchedUserJoin:unmatchedUsers,scriptChatOwnerMismatch:ownerMismatch};
 report.inputSize={totalCharacters,averageCharacters:Math.round(totalCharacters/Math.max(1,rows.length)),medianCharacters:lengths[Math.floor(lengths.length/2)]||0,p95Characters:lengths[Math.floor(lengths.length*.95)]||0,maxCharacters};
 report.databaseIntrospection={scope:'PostgREST OpenAPI metadata and limited GET reads',rlsPoliciesVerified:false,indexDefinitionsVerified:false,checkConstraintsVerified:false,derivedTables:'Not present in exposed public OpenAPI schema; other schemas not inspected'};
 report.credentialsAvailable={databaseConnection:configs.some(c=>Object.keys(c.env).some(k=>/^(DATABASE_URL|SUPABASE_DB_URL|POSTGRES_URL|SUPABASE_DB_PASSWORD)$/.test(k)&&c.env[k])),managementAccessToken:configs.some(c=>!!c.env.SUPABASE_ACCESS_TOKEN)};
 fs.mkdirSync(path.join(root,'docs','audits'),{recursive:true});
 fs.writeFileSync(path.join(root,'docs','audits','2026-10-14-supabase-insights-readonly.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
run().catch(e=>{console.error(JSON.stringify({error:e.message}));process.exitCode=1;});
