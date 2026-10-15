// Real PostgreSQL, synthetic schema/data only; no network, ports, mounts or Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const name = `bussola-admin-pg-test-${process.pid}`;
const admin = '10000000-0000-4000-8000-000000000001';
const user = '10000000-0000-4000-8000-000000000002';
const lit = value => `'${String(value).replace(/'/g, "''")}'`;
const json = value => `${lit(JSON.stringify(value))}::jsonb`;
const cli = (args, input) => spawnSync('docker', args, { input, encoding: 'utf8', timeout: 45000, windowsHide: true });
function sql(input, ok = true) {
  const result = cli(['exec', '-i', name, 'psql', '-XqAt', '-U', 'postgres', '-d', 'admin_test', '-v', 'ON_ERROR_STOP=1'], input);
  if (ok && result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Postgres failed');
  if (!ok) { assert.notEqual(result.status, 0, 'SQL operation should fail'); return result.stderr; }
  return result.stdout.trim();
}
const prefix = "SET request.jwt.claim.role='service_role'; SET ROLE service_role;\n";
const query = input => sql(prefix + input);
const read = () => JSON.parse(query(`SELECT public.admin_users_read('${admin}','${user}');`));
const mutate = (op, id, revision, data, passwordHash = null) => query(`SELECT public.admin_users_mutate('${admin}',${lit(op)},${id ? lit(id) : 'NULL'},${revision ? lit(revision) : 'NULL'},${json(data)},${passwordHash ? lit(passwordHash) : 'NULL'});`);
const assertFail = (statement, pattern) => assert.match(sql(prefix + statement, false), pattern);
const accessInput = row => row.access.map(({ agentType, enabled, expiresAt }) => ({ agentType, enabled, expiresAt }));
const grantRows = () => JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY agent_type),'[]') FROM user_agent_access a WHERE user_id='${user}';`));
const fixture = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
CREATE TABLE public.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text NOT NULL UNIQUE,nome text,telefone text,nivel text DEFAULT 'user',plano text,data_expiracao date,senha text NOT NULL,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.user_agent_access(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id),agent_type text NOT NULL,enabled boolean NOT NULL DEFAULT false,expires_at date,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(user_id,agent_type));
CREATE TABLE public.password_reset_tokens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text,used_at timestamptz,token_hash text,expires_at timestamptz,created_at timestamptz DEFAULT now());
INSERT INTO users(id,email,nome,nivel,plano,senha) VALUES('${admin}','admin@example.invalid','Admin ficticio','admin','Todas','fixture-only'),('${user}','pessoa@example.invalid','Pessoa ficticia','user','Todas','fixture-only');
`;
async function concurrent(input) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', name, 'psql', '-XqAt', '-U', 'postgres', '-d', 'admin_test', '-v', 'ON_ERROR_STOP=1'], { windowsHide: true });
    let out = '', err = ''; child.stdout.on('data', x => out += x); child.stderr.on('data', x => err += x);
    child.on('error', reject); child.on('close', code => resolve({ code, out, err })); child.stdin.end(input);
  });
}
(async () => {
  let started = false;
  try {
    const result = cli(['run', '--rm', '-d', '--name', name, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data:rw,size=256m', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=admin_test', 'postgres:17-alpine']);
    if (result.status !== 0) throw new Error(result.stderr || 'Could not start isolated Postgres');
    started = true;
    let ready = false;
    for (let i = 0; i < 30; i++) {
      if (cli(['exec', name, 'pg_isready', '-U', 'postgres', '-d', 'admin_test']).status === 0) { ready = true; break; }
      await new Promise(r => setTimeout(r, 250));
    }
    assert.ok(ready, 'Temporary PostgreSQL must become ready');
    sql(fixture);
    sql("INSERT INTO users(email,nome,senha) VALUES('PESSOA@example.invalid','Duplicate fixture','fixture');");
    assert.match(sql(fs.readFileSync(path.join(root,'supabase/migrations/20261015000001_admin_users.sql'),'utf8'), false), /normalized_email_duplicates_require_review/);
    assert.equal(sql("SELECT to_regclass('public.admin_user_audit') IS NULL;"),'t');
    sql("DELETE FROM users WHERE email='PESSOA@example.invalid';");
    for (const filename of ['20261015000001_admin_users.sql', '20261015000002_admin_invitations.sql']) sql(fs.readFileSync(path.join(root, 'supabase/migrations', filename), 'utf8'));
    console.log('Both migrations applied to synthetic PostgreSQL');
    let row = read(); assert.equal(row.access.filter(a => a.effective).length, 4);
    assert.doesNotMatch(JSON.stringify(row), /senha|token_hash|fixture-only/);
    assert.match(sql(`SET ROLE anon; SELECT public.admin_users_read('${admin}',NULL);`, false), /permission denied/);
    assertFail(`SELECT public.admin_users_read('${user}',NULL);`, /forbidden/);
    const before = row.revision;
    row = JSON.parse(mutate('access', user, before, {access:accessInput(row).map(a => a.agentType === 'postagem' ? {...a,enabled:false} : a),reason:'Revogacao parcial ficticia'}));
    assert.equal(row.plano, 'Personalizado'); assert.equal(row.access.filter(a => a.effective).length, 3);
    assertFail(`SELECT public.admin_users_mutate('${admin}','profile','${user}',${lit(before)},${json({nome:'Conflito',reason:'Revisao obsoleta'})});`, /revision_conflict/);
    assertFail(`SELECT public.admin_users_mutate('${admin}','profile','${admin}',${lit(row.revision)},${json({nome:'Nao permitido',reason:'Protecao admin'})});`, /admin_target_locked/);
    sql(`UPDATE users SET telefone='novo no n8n ficticio' WHERE id='${user}';`);
    assert.notEqual(read().revision, row.revision, 'External updates change snapshot revision');
    // Exact synthetic commercial case: LinkedIn 2027, three other IAs 2026.
    // Use external fixture inserts so this preservation test is independent of
    // today's date and the panel's prohibition on newly granted expired access.
    sql(`UPDATE user_agent_access SET enabled=true, expires_at=CASE WHEN agent_type='postagem' THEN '2027-12-31'::date ELSE '2026-12-31'::date END, created_at='2020-01-01', updated_at='2020-01-02' WHERE user_id='${user}';`);
    row = read();
    const originalGrants = grantRows();
    const originalUser = JSON.parse(sql(`SELECT to_jsonb(u) FROM users u WHERE id='${user}';`));
    row = JSON.parse(mutate('access', user, row.revision, {access:accessInput(row).map(a => a.agentType==='comunicacao'?{...a,expiresAt:'2099-01-31'}:a),reason:'Renovar somente Comunicacao'}));
    assert.deepEqual(grantRows().filter(a=>a.agent_type!=='comunicacao'),originalGrants.filter(a=>a.agent_type!=='comunicacao'),'Unchanged rows preserve IDs, timestamps and all metadata');
    assert.deepEqual(JSON.parse(sql(`SELECT to_jsonb(u) FROM users u WHERE id='${user}';`)), originalUser, 'Unchanged source user fields are preserved');
    const renewed = grantRows();
    row = JSON.parse(mutate('access', user, row.revision, {access:accessInput(row).map(a => a.agentType==='comunicacao'?{...a,enabled:false}:a),reason:'Revogar somente Comunicacao'}));
    assert.deepEqual(grantRows().filter(a=>a.agent_type!=='comunicacao'),renewed.filter(a=>a.agent_type!=='comunicacao'));
    assert.equal(row.access.find(a=>a.agentType==='postagem').expiresAt,'2027-12-31');
    const revoked = grantRows();
    row = JSON.parse(mutate('access', user, row.revision, {access:accessInput(row),reason:'Salvar sem alterar grants'}));
    assert.deepEqual(grantRows(),revoked,'A no-op access submission never touches grant timestamps');
    const good = accessInput(row), stableRevision = row.revision;
    const auditCount = sql(`SELECT count(*) FROM admin_user_audit WHERE user_id='${user}';`);
    const invalidPayloads = [
      {agentTypes:['postagem'],expiresAt:null,reason:'Contrato legado'},
      {access:good,expiresAt:null,reason:'Contrato misto'},
      ...[null,{},[],good.slice(1),[...good,good[0]],[good[0],good[0],...good.slice(2)],
        [null,...good.slice(1)], [1,...good.slice(1)],
        good.map((a,i)=>i?a:{...a,agentType:'unknown'}),
        good.map((a,i)=>i?a:{...a,enabled:'true'}),
        good.map((a,i)=>i?a:{agentType:a.agentType,enabled:true}),
        good.map((a,i)=>i?a:{...a,expiresAt:'2026-02-30'}),
        good.map((a,i)=>i?a:{...a,extra:true}),
        good.map((a,i)=>i?a:{...a,enabled:true,expiresAt:'2000-01-01'})
      ].map(access=>({access,reason:'Payload invalido'})),
    ];
    for(const data of invalidPayloads) assertFail(`SELECT public.admin_users_mutate('${admin}','access','${user}',${lit(stableRevision)},${json(data)});`,/invalid_input/);
    assert.equal(read().revision,stableRevision,'Failed inputs cannot change revision');
    assert.deepEqual(grantRows(),revoked,'Failed inputs cannot change grants');
    assert.equal(sql(`SELECT count(*) FROM admin_user_audit WHERE user_id='${user}';`),auditCount,'Failed inputs cannot write audit');
    // Global plans ignore underlying grant dates/enabled flags. Convert from
    // the displayed global entitlement even with missing or stale grant rows.
    for(const plan of ['Todas','Ambas']) {
      sql(`UPDATE users SET plano=${lit(plan)},data_expiracao='2098-11-30' WHERE id='${user}'; DELETE FROM user_agent_access WHERE user_id='${user}' AND agent_type='apresentacao'; UPDATE user_agent_access SET enabled=false,expires_at='2000-01-01' WHERE user_id='${user}';`);
      row=read(); assert.ok(row.access.every(a=>a.enabled&&a.expiresAt==='2098-11-30'));
      row=JSON.parse(mutate('access',user,row.revision,{access:accessInput(row).map(a=>a.agentType==='postagem'?{...a,enabled:false}:a),reason:'Individualizar plano global'}));
      assert.equal(row.plano,'Personalizado'); assert.equal(row.data_expiracao,null);
      assert.ok(row.access.filter(a=>a.agentType!=='postagem').every(a=>a.enabled&&a.effective&&a.expiresAt==='2098-11-30'));
      assert.equal(row.access.find(a=>a.agentType==='postagem').enabled,false);
    }
    // A residual global cap on an individual plan must remain an effective
    // cap after materialization; clearing it cannot reactivate expired access.
    sql(`UPDATE users SET plano='Personalizado',data_expiracao='2000-12-31' WHERE id='${user}'; UPDATE user_agent_access SET enabled=true,expires_at=CASE WHEN agent_type='postagem' THEN '2000-06-30'::date ELSE '2099-12-31'::date END WHERE user_id='${user}';`);
    row=read();
    assert.equal(row.access.find(a=>a.agentType==='postagem').expiresAt,'2000-06-30');
    assert.ok(row.access.filter(a=>a.agentType!=='postagem').every(a=>a.expiresAt==='2000-12-31'&&!a.effective));
    row=JSON.parse(mutate('access',user,row.revision,{access:accessInput(row).map(a=>a.agentType==='comunicacao'?{...a,expiresAt:'2099-01-31'}:a),reason:'Renovar apenas uma preservando cap residual'}));
    assert.equal(row.data_expiracao,null);
    assert.ok(row.access.filter(a=>a.agentType!=='comunicacao').every(a=>!a.effective));
    assert.equal(row.access.find(a=>a.agentType==='postagem').expiresAt,'2000-06-30');
    // Same full payload cannot be replayed after an external grant change.
    const priorRevision=row.revision;
    sql(`UPDATE user_agent_access SET expires_at='2099-06-30' WHERE user_id='${user}' AND agent_type='postagem';`);
    assertFail(`SELECT public.admin_users_mutate('${admin}','access','${user}',${lit(priorRevision)},${json({access:accessInput(row),reason:'Snapshot obsoleto'})});`,/revision_conflict/);
    const bcrypt = require('bcryptjs'); const passwordHash = await bcrypt.hash('senha-ficticia-local-apenas', 12);
    const created = JSON.parse(mutate('create', null, null, {nome:'Nova Pessoa',email:'novo@example.invalid',telefone:null,agentTypes:['comunicacao'],expiresAt:null,reason:'Criacao ficticia'}, passwordHash));
    assert.equal(created.nivel, 'user'); assert.ok(created.id);
    assert.match(sql(`INSERT INTO users(email,nome,nivel,senha) VALUES(' NOVO@example.invalid ','External duplicate','user','fixture');`, false), /duplicate key/i);
    assertFail(`SELECT public.admin_users_mutate('${admin}','create',NULL,NULL,${json({nome:'Duplicado',email:'NOVO@example.invalid',telefone:null,agentTypes:[],expiresAt:null,reason:'Duplicidade'})},${lit(passwordHash)});`, /duplicate_email/);
    const tokenHash = 'a'.repeat(64), expiry = new Date(Date.now() + 3500000).toISOString();
    const issue = () => `SELECT public.admin_users_issue_invite('${admin}','${user}',${lit(read().revision)},'generate','Primeiro acesso ficticio',${lit(tokenHash)},${lit(expiry)});`;
    const issued = JSON.parse(query(issue())); assert.ok(issued);
    assert.equal(JSON.parse(query(`SELECT public.admin_users_validate_invite(${lit(tokenHash)});`)).valid, true);
    assertFail(issue(), /cooldown|revision conflict/);
    query(`SELECT public.admin_users_consume_invite(${lit(tokenHash)},${lit(passwordHash)});`);
    assertFail(`SELECT public.admin_users_consume_invite(${lit(tokenHash)},${lit(passwordHash)});`, /invalid|expired|used/i);
    assert.equal(sql(`SELECT senha FROM users WHERE id='${user}';`), passwordHash);
    // Reassignment cannot leave legacy email-only reset tokens usable.
    sql(`INSERT INTO password_reset_tokens(email,token_hash,expires_at) VALUES('novo@example.invalid','legacy-fixture',now()+interval '1 hour');`);
    const updatedCreated = JSON.parse(mutate('profile',created.id,created.revision,{email:'outro@example.invalid',reason:'Troca ficticia de identidade'}));
    assert.equal(sql("SELECT count(*) FROM password_reset_tokens WHERE email='novo@example.invalid' AND used_at IS NULL;"),'0');
    assert.equal(updatedCreated.email,'outro@example.invalid');
    // An independently reset password invalidates a previously issued invite.
    sql(`UPDATE admin_user_invitations SET created_at=now()-interval '2 minutes' WHERE user_id='${user}';`);
    const freshHash='b'.repeat(64);
    query(`SELECT public.admin_users_issue_invite('${admin}','${user}',${lit(read().revision)},'generate','Segundo convite ficticio',${lit(freshHash)},${lit(expiry)});`);
    sql(`UPDATE users SET senha='independent-reset-fixture' WHERE id='${user}';`);
    assert.equal(JSON.parse(query(`SELECT public.admin_users_validate_invite(${lit(freshHash)});`)).valid,false);
    assertFail(`SELECT public.admin_users_consume_invite(${lit(freshHash)},${lit(passwordHash)});`,/invalid|expired/i);
    // Legacy recovery and managed invitation cannot both consume independently.
    sql(`UPDATE admin_user_invitations SET created_at=now()-interval '2 minutes' WHERE user_id='${user}';`);
    const raceInvite='c'.repeat(64), raceReset='d'.repeat(64);
    query(`SELECT public.admin_users_issue_invite('${admin}','${user}',${lit(read().revision)},'generate','Convite concorrente ficticio',${lit(raceInvite)},${lit(expiry)});`);
    sql(`INSERT INTO password_reset_tokens(email,token_hash,expires_at) VALUES('pessoa@example.invalid',${lit(raceReset)},now()+interval '1 hour');`);
    const passwordPair = await Promise.all([
      concurrent(prefix+`BEGIN; SELECT public.admin_users_consume_invite(${lit(raceInvite)},${lit(passwordHash)}); SELECT pg_sleep(0.3); COMMIT;`),
      concurrent(prefix+`SELECT public.admin_users_consume_legacy_reset('pessoa@example.invalid',${lit(raceReset)},${lit(passwordHash)});`),
    ]);
    assert.equal(passwordPair.filter(r=>r.code===0).length,1,'Only one concurrent credential flow can consume');
    assertFail(`SELECT public.admin_users_consume_legacy_reset('pessoa@example.invalid',${lit(raceReset)},${lit(passwordHash)});`,/invalid/i);
    // Two transactions using one snapshot: exactly one write may win.
    const rev = read().revision;
    const statement = `SELECT public.admin_users_mutate('${admin}','profile','${user}',${lit(rev)},${json({nome:'Concorrencia ficticia',reason:'Validacao concorrente'})});`;
    const pair = await Promise.all([concurrent(prefix + 'BEGIN; ' + statement + ' SELECT pg_sleep(0.3); COMMIT;'), concurrent(prefix + statement)]);
    assert.equal(pair.filter(r => r.code === 0).length, 1); assert.match(pair.find(r => r.code !== 0).err, /revision_conflict/);
    const audit = query(`SELECT public.admin_users_audit_read('${admin}','${user}');`);
    assert.doesNotMatch(audit, new RegExp(tokenHash)); assert.doesNotMatch(audit, /token_hash|\$2b\$/);
    console.log(JSON.stringify({postgres:'passed',migrations:2,permissions:true,individualExpiryPreserved:true,unchangedGrantMetadata:true,granularValidation:true,globalRevocation:true,residualCapPreserved:true,externalRevision:true,duplicates:true,invitationSingleUse:true,concurrentRevision:true,auditNoSecrets:true,network:'none',productionAccess:false}));
  } finally {
    if (started) { const stop = cli(['stop', name]); if (stop.status !== 0) throw new Error('Could not stop isolated test container'); }
  }
})().catch(err => { console.error(err.message); process.exitCode = 1; });
