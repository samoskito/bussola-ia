// Explicit GET-only investigation. Personal details are printed for the owner,
// never persisted to an audit file. No passwords, tokens or message text read.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync(path.join(__dirname,'../.env.local')));
const base = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co')) throw new Error('Unexpected Supabase host');
const key = env.SUPABASE_SERVICE_ROLE_KEY;
async function get(table,params={},count=false,metadata=false) {
  const url = new URL('/rest/v1/'+table,base);
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));
  const response = await fetch(url,{method:'GET',headers:{apikey:key,Authorization:'Bearer '+key,Accept:metadata?'application/openapi+json':'application/json',...(count?{Prefer:'count=exact'}:{})},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('GET '+table+' failed HTTP '+response.status);
  return {data:await response.json(),count:count?Number(response.headers.get('content-range')?.split('/')[1]):undefined};
}
async function paged(table,params) {
  const rows=[];
  for(let offset=0;offset<20000;offset+=500){const r=await get(table,{...params,limit:500,offset});rows.push(...r.data);if(r.data.length<500)return rows;}
  throw new Error('Read cap reached; no incomplete conclusions');
}
(async()=>{
  const users=await paged('users',{select:'id,email',order:'id.asc'});
  const groups=new Map();
  for(const u of users){const normalized=(u.email??'').trim().toLowerCase();if(!groups.has(normalized))groups.set(normalized,[]);groups.get(normalized).push(u);}
  const targets=[...groups].filter(([email,rows])=>!email||rows.length>1);
  const schema=(await get('',{},false,true)).data.definitions||{};
  const refs=[];
  for(const [table,def] of Object.entries(schema))for(const [column,p]of Object.entries(def.properties||{})){
    if(/Foreign Key/i.test(p.description||'')&&/users/i.test(p.description||''))refs.push({table,column,description:p.description});
  }
  console.log(JSON.stringify({timestamp:new Date().toISOString(),method:'GET only',writes:0,usersScanned:users.length,groups:targets.length,foreignKeyMetadata:refs}));
  for(const [normalized,rows]of targets){
    const detail=[];
    for(const row of rows){
      if(!/^[0-9a-f-]{36}$/i.test(row.id))throw new Error('Unexpected user id');
      const params={id:'eq.'+row.id};
      const user=(await get('users',{...params,select:'id,nome,email,telefone,nivel,plano,data_expiracao,created_at,updated_at,cargo,empresa,rua,numero,bairro,cep,cidade,estado,pais'})).data[0];
      const history={};
      for(const table of ['chats','scripts']){
        history[table]=(await get(table,{select:'id',user_id:'eq.'+row.id,limit:0},true)).count;
        history['latest_'+table]=(await get(table,{select:'created_at',user_id:'eq.'+row.id,order:'created_at.desc',limit:1})).data[0]?.created_at||null;
      }
      history.emailTemplatesUpdated=(await get('email_templates',{select:'id',updated_by:'eq.'+row.id,limit:0},true)).count;
      if(normalized){
        // These case-only addresses have no PostgREST pattern wildcards.
        if(/[%_]/.test(normalized))throw new Error('Review literal email filtering before counting tokens');
        history.legacyResetRecords=(await get('password_reset_tokens',{select:'id',email:'ilike.'+normalized,limit:0},true)).count;
        history.pendingValidResetRecords=(await get('password_reset_tokens',{select:'id',email:'ilike.'+normalized,used_at:'is.null',expires_at:'gt.'+new Date().toISOString(),limit:0},true)).count;
      }
      const grants=(await get('user_agent_access',{select:'agent_type,enabled,expires_at,created_at,updated_at',user_id:'eq.'+row.id,order:'agent_type.asc'})).data;
      const sourceEmail=user.email;
      const address={};for(const field of ['rua','numero','bairro','cep','cidade','estado','pais']){address[field]=!!user[field];delete user[field];}
      detail.push({...user,email:sourceEmail,emailHasSurroundingWhitespace:sourceEmail!==sourceEmail?.trim(),addressFieldsPresent:address,history,grants});
    }
    console.log(JSON.stringify({normalizedEmail:normalized||'(empty)',accounts:detail}));
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
