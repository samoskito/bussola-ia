// Synthetic PostgreSQL15.8 only: no ports, host data, credentials or network.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync,spawn}=require('node:child_process');
const name='bussola-insights-pg-'+Date.now(),root=path.resolve(__dirname,'../..');
const cli=(args,input)=>spawnSync('docker',args,{input,encoding:'utf8',windowsHide:true,timeout:45000});
const sql=(s,ok=true)=>{const r=cli(['exec','-i',name,'psql','-XqAt','-U','postgres','-v','ON_ERROR_STOP=1'],s);if(ok&&r.status!==0)throw Error(r.stderr||'SQL failure');if(!ok)assert.notEqual(r.status,0);return ok?r.stdout.trim():r.stderr;};
const prefix="SET request.jwt.claim.role='service_role'; SET ROLE service_role; ",query=s=>sql(prefix+s),lit=s=>"'"+String(s).replaceAll("'","''")+"'";
const u='10000000-0000-4000-8000-000000000001',a='10000000-0000-4000-8000-000000000002',c='20000000-0000-4000-8000-000000000001',h='a'.repeat(64),key='1:'+h;
const claim=(id=1,user=u,hash=h)=>`SELECT insights_claim_job('${id}:${hash}',${id},'${user}','${hash}','2026-10-14.v1','gpt-6-luna.2026-10-14.v1',clock_timestamp(),60000,3);`;
const classification={kind:'question',topicIds:['feedback'],normalizedDemand:'Preparar feedback fictício.',confidence:.9,needsReview:false};
const complete=token=>`SELECT insights_complete_job('${key}','${token}',${lit(JSON.stringify(classification))}::jsonb,clock_timestamp(),'{}'::jsonb,'comunicacao','${c}','2026-10-15T00:00:00Z');`;
function concurrent(s){return new Promise((resolve,reject)=>{const p=spawn('docker',['exec','-i',name,'psql','-XqAt','-U','postgres','-v','ON_ERROR_STOP=1'],{windowsHide:true});let out='',err='';p.stdout.on('data',v=>out+=v);p.stderr.on('data',v=>err+=v);p.on('error',reject);p.on('close',code=>resolve({code,out:out.trim(),err}));p.stdin.end(prefix+s);});}
(async()=>{let started=false;try{
 const r=cli(['run','--rm','-d','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data:rw,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:15.8-alpine']);assert.equal(r.status,0,r.stderr);started=true;
 for(let i=0;i<40;i++){if(cli(['exec',name,'pg_isready','-U','postgres']).status===0)break;await new Promise(r=>setTimeout(r,250));}
 sql(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;CREATE TABLE users(id uuid PRIMARY KEY,nivel text);CREATE TABLE chats(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),agent_type text);CREATE TABLE scripts(id integer PRIMARY KEY,user_id uuid REFERENCES users(id),chatid uuid REFERENCES chats(id),input text,created_at timestamptz);INSERT INTO users VALUES('${u}','user'),('${a}','admin');INSERT INTO chats VALUES('${c}','${u}','comunicacao'),('20000000-0000-4000-8000-000000000002','${a}','comunicacao');INSERT INTO scripts VALUES(1,'${u}','${c}','Pergunta fictícia','2026-10-15T00:00:00Z'),(2,'${a}','20000000-0000-4000-8000-000000000002','Admin fictício','2026-10-15T00:00:00Z');`);
 sql(fs.readFileSync(path.join(root,'supabase/migrations/20261014000001_insights.sql'),'utf8'));
 assert.equal(sql("SELECT count(*) FROM pg_class WHERE relname IN('insights_taxonomies','insight_jobs','script_insights','insights_budgets') AND relrowsecurity;"),'4');
 assert.match(sql("SET ROLE anon;SELECT * FROM script_insights;",false),/permission denied/);assert.match(sql("SET ROLE authenticated;SELECT insights_reserve_budget('bad',.1,1);",false),/permission denied/);
 assert.equal(JSON.parse(query(claim(2,a))).state,'failed');
 const lease=JSON.parse(query(claim()));assert.equal(lease.state,'claimed');assert.equal(JSON.parse(query(claim())).state,'locked');
 assert.equal(query(complete('30000000-0000-4000-8000-000000000001')),'f');assert.equal(query(complete(lease.token)),'t');assert.equal(query(complete(lease.token)),'f');assert.equal(JSON.parse(query(claim())).state,'completed');
 const b=await Promise.all([concurrent("SELECT insights_reserve_budget('pilot',.6,1);"),concurrent("SELECT insights_reserve_budget('pilot',.6,1);")]);assert.ok(b.every(r=>r.code===0));assert.deepEqual(b.map(r=>r.out).sort(),['f','t']);assert.equal(query("SELECT insights_reserve_budget('pilot',.5,2);"),'f');assert.equal(query("SELECT cap_usd FROM insights_budgets WHERE scope='pilot';"),'1.000000');query("SELECT insights_release_budget('pilot',.2);");assert.equal(query("SELECT insights_reserve_budget('pilot',.6,1);"),'t');
 assert.match(sql(prefix+"SELECT insights_reserve_budget('bad','NaN',1);",false),/invalid_budget/);
 const h2='b'.repeat(64),k2='1:'+h2,lease2=JSON.parse(query(claim(1,u,h2)));assert.equal(lease2.state,'claimed');
 assert.equal(query(`SELECT insights_fail_job('${k2}','${lease2.token}',clock_timestamp(),'classification_failed',3);`),'t');assert.equal(JSON.parse(query(claim(1,u,h2))).state,'waiting');
 sql(`UPDATE insight_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE job_key='${k2}';`);const lease3=JSON.parse(query(claim(1,u,h2)));assert.equal(lease3.state,'claimed');
 sql(`UPDATE users SET nivel='admin' WHERE id='${u}';`);assert.equal(query(complete(lease3.token).replace(key,k2)),'f');assert.equal(query('SELECT count(*) FROM script_insights;'),'0');
 assert.equal(sql('SELECT count(*) FROM users;'),'2');assert.equal(sql('SELECT count(*) FROM scripts;'),'2');
 console.log('PASS PostgreSQL15.8: schema/RLS/roles, admin exclusion, leases/CAS/idempotence, retry, concurrent budget/cap, role change cleanup; synthetic sources preserved.');
}finally{if(started)cli(['rm','-f',name]);}})().catch(e=>{console.error(e.message);process.exitCode=1;});
