// Offline recovery verification. Private rows exist only in memory and container tmpfs.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const file=path.resolve(process.argv[2]||'');
const run=(args,input)=>spawnSync('docker',args,{input,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
const decrypted=spawnSync('powershell',['-NoProfile','-Command',"Add-Type -AssemblyName System.Security; $cipher=[Console]::In.ReadToEnd(); $bytes=[Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($cipher),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes))"],{input:fs.readFileSync(file,'utf8'),encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
if(decrypted.status!==0)throw Error('DPAPI decryption failed');
const snapshot=JSON.parse(decrypted.stdout),q=s=>'"'+s.replaceAll('"','""')+'"',lit=s=>"'"+String(s).replaceAll("'","''")+"'";
const name='bussola-backup-recovery-'+Date.now();
let phase='start';
try {
 const start=run(['run','--rm','-d','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:15.8-alpine']);
 if(start.status!==0)throw Error('Container start failed');
 let ready=false; for(let i=0;i<40;i++){if(run(['exec',name,'pg_isready','-U','postgres']).status===0){ready=true;break;} Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);}
 if(!ready)throw Error('Postgres readiness failed');
 const sql=["SET timezone='UTC'; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;"];
 for(const definition of snapshot.functions||[])sql.push(definition+';');
 const tables=['users','password_reset_tokens','user_agent_access','email_templates'];
 for(const table of tables){sql.push('CREATE TABLE public.'+q(table)+' ('+snapshot.columns.filter(c=>c.table===table).map(c=>q(c.name)+' '+c.type+(c.default?' DEFAULT '+c.default:'')+(c.notNull?' NOT NULL':'')).join(',')+');');}
 for(const c of snapshot.constraints||[])sql.push('ALTER TABLE public.'+q(c.table)+' ADD CONSTRAINT '+q(c.name)+' '+c.definition+';');
 for(const table of tables)sql.push('INSERT INTO public.'+q(table)+' SELECT * FROM jsonb_populate_recordset(NULL::public.'+q(table)+',('+lit(decrypted.stdout)+'::jsonb)->\'tables\'->'+lit(table)+');');
 for(const definition of [...snapshot.indexes||[],...snapshot.triggers||[]])sql.push(definition+';');
 for(const p of snapshot.policies||[])sql.push('CREATE POLICY '+q(p.policyname)+' ON public.'+q(p.tablename)+' AS '+p.permissive+' FOR '+p.cmd+' TO '+p.roles.map(r=>r==='public'?'PUBLIC':q(r)).join(',')+(p.qual?' USING ('+p.qual+')':'')+(p.with_check?' WITH CHECK ('+p.with_check+')':'')+';');
 for(const r of snapshot.rls||[]){if(r.enabled)sql.push('ALTER TABLE public.'+q(r.table)+' ENABLE ROW LEVEL SECURITY;');if(r.forced)sql.push('ALTER TABLE public.'+q(r.table)+' FORCE ROW LEVEL SECURITY;');}
 for(const g of snapshot.grants||[])sql.push('GRANT '+g.privilege+' ON public.'+q(g.table)+' TO '+(g.role==='PUBLIC'?'PUBLIC':q(g.role))+(g.grantable?' WITH GRANT OPTION':'')+';');
 phase='restore';
 const restored=run(['exec','-i',name,'psql','-X','-U','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-q'],sql.join('\n'));
 if(restored.status!==0)throw Error('Restore failed SQLSTATE '+((restored.stderr||'').match(/ERROR:\s+(\w{5})/)?.[1]||'unavailable'));
 phase='verify'; const results={};
 for(const table of tables){
 const check=run(['exec','-i',name,'psql','-X','-U','postgres','-At','-v','ON_ERROR_STOP=1'],"SET timezone='UTC'; SELECT json_build_object('count',count(*),'digest',md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb)::text)) FROM public."+q(table)+' t;');
 if(check.status!==0)throw Error('Readback failed');const result=JSON.parse(check.stdout.trim().split('\n').at(-1));
 if(result.count!==snapshot.counts[table]||result.digest!==snapshot.digests[table]){
 const equal=run(['exec','-i',name,'psql','-X','-U','postgres','-At','-q'],"SET timezone='UTC'; SELECT (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb) FROM public."+q(table)+" t) = (("+lit(decrypted.stdout)+"::jsonb)->'tables'->"+lit(table)+');');
 if(result.count!==snapshot.counts[table]||equal.status!==0||equal.stdout.trim()!=='t')throw Error('Recovery mismatch for '+table);
 } results[table]=result.count;}
 const receipt={verifiedAt:new Date().toISOString(),sourceTimestamp:snapshot.timestamp,project:snapshot.project,postgres:'15.8',scope:tables,counts:results,countsAndValuesMatch:true,comparison:'Ordered JSONB equality for all records; text digests may differ due to numeric formatting after type restoration.',definitionsRestored:true,isolatedNetwork:true,tmpfsOnly:true,encryptedBackup:path.basename(file),limitations:'Only four affected tables and definitions; excludes other tables, external history rows, Storage objects and full-project disaster recovery.'};
 fs.writeFileSync(path.join(__dirname,'../docs/audits/2026-10-15-admin-backup-recovery.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}catch(e){console.error('Local recovery verification failed at '+phase+': '+e.message);process.exitCode=1;}finally{run(['rm','-f',name]);}
