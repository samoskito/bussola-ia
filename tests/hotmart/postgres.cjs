// PostgreSQL real descartável: esquema/dados sintéticos, sem rede, portas ou volumes.
// Aplica as migrations admin + Hotmart e exercita RPCs com planos do motor TS.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const bcrypt = require('bcryptjs');
const { fs, path, root, load } = require('./helpers.cjs');

const image = process.env.HOTMART_PG_IMAGE || 'postgres:16';
const name = `bussola-hotmart-pg-test-${process.pid}`;
const admin = '10000000-0000-4000-8000-000000000001';
const existing = '10000000-0000-4000-8000-000000000002';
const legacy = '10000000-0000-4000-8000-000000000003';
const lit = value => value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;
const json = value => `${lit(JSON.stringify(value))}::jsonb`;
const cli = (args, input) => spawnSync('docker', args, { input, encoding: 'utf8', timeout: 60000, windowsHide: true });
function sql(input, ok = true) {
  const result = cli(['exec', '-i', name, 'psql', '-XqAt', '-U', 'postgres', '-d', 'hotmart_test', '-v', 'ON_ERROR_STOP=1'], input);
  if (ok && result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Postgres failed');
  if (!ok) { assert.notEqual(result.status, 0, 'SQL deveria falhar'); return result.stderr; }
  return result.stdout.trim();
}
const prefix = "SET request.jwt.claim.role='service_role'; SET ROLE service_role;\n";
const q = input => sql(prefix + input);
const qj = input => JSON.parse(q(input));
const fail = (input, pattern) => assert.match(sql(prefix + input, false), pattern);
const rules = load('rules');
const { normalizeHotmartEvent } = load('normalize');

const fixture = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
CREATE TABLE public.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text NOT NULL UNIQUE,nome text,telefone text,nivel text DEFAULT 'user',plano text,data_expiracao date,senha text NOT NULL,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
  CONSTRAINT users_plano_check CHECK (plano IS NULL OR plano IN ('Todas','Comunicação Executiva','Apresentação para Reunião de Resultados','Conversas Dificeis','Postagem no Linkedin','Personalizado','Ambas')));
CREATE TABLE public.user_agent_access(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id),agent_type text NOT NULL,enabled boolean NOT NULL DEFAULT false,expires_at date,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(user_id,agent_type));
CREATE TABLE public.password_reset_tokens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text,used_at timestamptz,token_hash text,expires_at timestamptz,created_at timestamptz DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
INSERT INTO users(id,email,nome,telefone,nivel,plano,data_expiracao,senha) VALUES
 ('${admin}','admin@example.invalid','Admin ficticio',NULL,'admin','Todas',NULL,'fixture-only'),
 ('${existing}','existente@example.invalid','Nome Manual',NULL,'user','Personalizado',NULL,'fixture-only'),
 ('${legacy}','legado@example.invalid','Legado n8n','11 90000-0001','user','Todas','2027-06-30','fixture-only');
`;

let seq = 0;
function rawEvent({ type = 'PURCHASE_APPROVED', email, tx, offer = 'off1', created = '2026-10-22T12:00:00Z', name = 'Comprador Teste', phone = '11900000000' }) {
  seq++;
  return { id: `evt-${seq}`, creation_date: Date.parse(created), event: type, version: '2.0.0',
    data: { product: { id: 111, ucode: 'uc-prod', name: 'Bussola' }, buyer: { email, name, checkout_phone: phone, document: '12345678909', address: { address: 'Rua Sigilosa' } },
      purchase: { transaction: tx, status: 'APPROVED', approved_date: Date.parse(created), offer: { code: offer } } } };
}
function ingest(body, mode) {
  const raw = JSON.stringify(body);
  return qj(`SELECT public.hotmart_ingest_event(${json(normalizeHotmartEvent(body, raw))}, ${lit(mode)});`);
}
async function processRow(id, { revisionOverride } = {}) {
  assert.equal(qj(`SELECT public.hotmart_claim_event(${lit(id)}, true);`).claimed, true);
  const ctx = qj(`SELECT public.hotmart_event_context(${lit(id)});`);
  const plan = rules.planHotmartEvent(ctx, { graceDays: 3 });
  if (plan.createUser) plan.createUser.passwordHash = await bcrypt.hash('segredo-aleatorio-de-teste', 12);
  const snapshot = ctx.emailUser ?? ctx.purchaseUser;
  return { plan, ctx, statement: `SELECT public.hotmart_commit_event(${lit(id)}, ${lit(revisionOverride ?? snapshot?.revision ?? null)}, ${json(plan)});` };
}
const counts = () => qj(`SELECT jsonb_build_object('users',(SELECT count(*) FROM users),'grants',(SELECT count(*) FROM user_agent_access),'purchases',(SELECT count(*) FROM hotmart_purchases),'state',(SELECT count(*) FROM hotmart_access_state),'audit',(SELECT count(*) FROM admin_user_audit));`);
const grants = id => qj(`SELECT COALESCE(jsonb_object_agg(agent_type, jsonb_build_object('enabled',enabled,'expiresAt',expires_at)),'{}') FROM user_agent_access WHERE user_id=${lit(id)};`);

(async () => {
  let started = false;
  try {
    const run = cli(['run', '--rm', '-d', '--name', name, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data:rw,size=256m', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=hotmart_test', image]);
    if (run.status !== 0) throw new Error(run.stderr || 'Não foi possível iniciar o PostgreSQL isolado');
    started = true;
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      ready = cli(['exec', name, 'pg_isready', '-U', 'postgres', '-d', 'hotmart_test']).status === 0 && cli(['exec', name, 'psql', '-U', 'postgres', '-d', 'hotmart_test', '-c', 'SELECT 1']).status === 0;
      if (!ready) await new Promise(r => setTimeout(r, 500));
    }
    assert.ok(ready, 'PostgreSQL temporário precisa ficar pronto');
    console.log('PostgreSQL', sql('SHOW server_version;'));
    sql(fixture);
    // Sem as migrations admin a Hotmart aborta sem efeito.
    assert.match(sql(fs.readFileSync(path.join(root, 'supabase/migrations/20261022000001_hotmart_direct.sql'), 'utf8'), false), /admin_migrations_required/);
    for (const file of ['20261015000001_admin_users.sql', '20261015000002_admin_invitations.sql', '20261022000001_hotmart_direct.sql']) sql(fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'));
    console.log('Migrations admin + Hotmart aplicadas no schema sintético');

    // Permissões: somente service role; RLS em todas as tabelas novas.
    assert.match(sql("SET ROLE anon; SELECT public.hotmart_ingest_event('{}'::jsonb,'live');", false), /permission denied/);
    assert.match(sql('SET ROLE authenticated; SELECT * FROM public.hotmart_events;', false), /permission denied/);
    assert.match(sql("SET ROLE service_role; SELECT public.hotmart_apply_user_changes(gen_random_uuid(),'{}'::jsonb,true);", false), /permission denied/, 'helper interno não exposto');
    assert.match(sql("SET ROLE service_role; SELECT public.hotmart_insert_reviews(gen_random_uuid(),NULL,'[]'::jsonb);", false), /permission denied/);
    assert.match(sql("SET ROLE service_role; SELECT public.hotmart_user_snapshot(gen_random_uuid());", false), /permission denied/);
    assert.equal(sql("SELECT count(*) FROM pg_class WHERE relname LIKE 'hotmart_%' AND relkind='r' AND relrowsecurity;"), '5');
    fail("SELECT public.hotmart_ingest_event('{}'::jsonb,'live');", /hotmart:forbidden|null value|violates/);
    assert.match(sql("SET request.jwt.claim.role='anon'; SET ROLE service_role; SELECT public.hotmart_ingest_event('{}'::jsonb,'live');", false), /hotmart:forbidden/);

    // Sincronização + mapeamento pelo admin; usuário comum não pode.
    q(`SELECT public.hotmart_admin_sync_offers('${admin}', ${json([{ productId: '111', productUcode: 'uc-prod', productName: 'Bussola', offerCode: 'off1', offerName: 'Anual', paymentMode: 'UNIQUE_PAYMENT', isSubscription: false, planId: null, planName: null, priceValue: 297, priceCurrency: 'BRL', apiActive: true }])});`);
    fail(`SELECT public.hotmart_admin_read('${existing}','offers');`, /admin_users:forbidden/);
    const [offer] = qj(`SELECT public.hotmart_admin_read('${admin}','offers');`);
    assert.equal(offer.accessKind, null);
    fail(`SELECT public.hotmart_admin_configure_offer('${admin}','${offer.id}', ${json({ agentTypes: ['comunicacao'], accessKind: 'single', durationDays: null })});`, /invalid_input/);
    q(`SELECT public.hotmart_admin_configure_offer('${admin}','${offer.id}', ${json({ agentTypes: ['comunicacao', 'apresentacao'], accessKind: 'single', durationDays: 365, graceDays: null })});`);
    q(`SELECT public.hotmart_admin_sync_offers('${admin}', ${json([{ productUcode: 'uc-prod', offerCode: 'off1', offerName: 'Anual renomeada', isSubscription: false }])});`);
    assert.deepEqual(qj(`SELECT public.hotmart_admin_read('${admin}','offers');`)[0].agentTypes, ['comunicacao', 'apresentacao'], 'sync preserva mapeamento');

    // Idempotência: id repetido e (transação, evento) repetidos.
    const first = rawEvent({ email: 'novo@example.invalid', tx: 'HP-NEW' });
    const a = ingest(first, 'shadow');
    assert.equal(a.duplicate, false);
    assert.deepEqual(ingest(first, 'shadow'), { ...a, duplicate: true });
    // Mesma transação+evento com corpo diferente NÃO é descartado (id é a idempotência principal).
    const sameTx = ingest({ ...first, id: 'outro-id' }, 'shadow');
    assert.equal(sameTx.duplicate, false);
    assert.doesNotMatch(q('SELECT row_to_json(e)::text FROM hotmart_events e;'), /12345678909|Rua Sigilosa/, 'sem CPF/endereço no banco');

    // SHADOW: registra o plano sem escrever em users/grants/ledger.
    const before = counts();
    const shadow = await processRow(a.id);
    assert.equal(shadow.plan.createUser.email, 'novo@example.invalid');
    assert.equal(qj(shadow.statement).status, 'shadow_planned');
    assert.doesNotMatch(q(`SELECT plan::text FROM hotmart_events WHERE id=${lit(a.id)};`), /passwordHash|\$2[aby]\$/, 'shadow não guarda hash');
    assert.doesNotMatch(JSON.stringify(qj(`SELECT public.hotmart_admin_read('${admin}','events');`)), /passwordHash/);
    assert.deepEqual(counts(), before, 'shadow não escreve');
    const stored = qj(`SELECT plan FROM hotmart_events WHERE id=${lit(a.id)};`);
    assert.equal(stored.summary, shadow.plan.summary);
    assert.equal(qj(`SELECT public.hotmart_claim_event(${lit(a.id)});`).claimed, false, 'shadow é final');

    // LIVE: comprador novo é criado, IAs liberadas, ledger e auditoria de sistema.
    const live = ingest(rawEvent({ email: 'novo@example.invalid', tx: 'HP-LIVE' }), 'live');
    const created = qj((await processRow(live.id)).statement);
    assert.deepEqual([created.status, created.userCreated, created.invite], ['applied', true, true]);
    const newUser = qj(`SELECT to_jsonb(u) FROM users u WHERE id=${lit(created.userId)};`);
    assert.deepEqual([newUser.nivel, newUser.plano, newUser.nome, newUser.data_expiracao], ['user', 'Personalizado', 'Comprador Teste', null]);
    assert.match(newUser.senha, /^\$2[aby]\$12\$/);
    assert.equal(grants(created.userId).comunicacao.enabled, true);
    assert.equal(grants(created.userId).postagem, undefined);
    const audit = qj(`SELECT jsonb_agg(to_jsonb(a)) FROM admin_user_audit a WHERE user_id=${lit(created.userId)};`);
    assert.deepEqual([audit[0].actor_id, audit[0].action, audit[0].changes.actor], [null, 'hotmart_user_created', 'system:hotmart']);
    assert.doesNotMatch(q(`SELECT plan::text FROM hotmart_events WHERE id=${lit(live.id)};`), /\$2[aby]\$/, 'hash não fica no evento');
    // Convite do ator de sistema reaproveita a tabela de convites do painel.
    const invite = qj(`SELECT public.hotmart_issue_invite(${lit(created.userId)}, ${lit('a'.repeat(64))}, now() + interval '50 minutes', ${lit(live.id)});`);
    q(`SELECT public.hotmart_invite_delivery(${lit(invite.id)}, 'sent', ${lit(live.id)});`);
    // Convite de compra pode valer até 168 h (padrão 72 h no app); além disso é recusado.
    fail(`SELECT public.hotmart_issue_invite(${lit(created.userId)}, ${lit('d'.repeat(64))}, now() + interval '200 hours', ${lit(live.id)});`, /invalid invitation/);
    assert.deepEqual(qj(`SELECT jsonb_build_object('by',issued_by,'sys',issued_by_system,'st',delivery_status) FROM admin_user_invitations WHERE id=${lit(invite.id)};`), { by: null, sys: 'hotmart', st: 'sent' });
    assert.equal(qj(`SELECT public.admin_users_validate_invite(${lit('a'.repeat(64))});`).valid, true, 'consumo segue o fluxo existente');
    const v2 = qj(`SELECT public.admin_users_audit_read_v2('${admin}', ${lit(created.userId)});`);
    assert.ok(v2.some(e => e.actor === 'Sistema Hotmart'));
    fail(`INSERT INTO admin_user_invitations(user_id,email_snapshot,credential_fingerprint,token_hash,expires_at,action,delivery_status) VALUES(${lit(created.userId)},'x','${'b'.repeat(64)}','${'c'.repeat(64)}',now(),'send','pending');`, /issuer_chk|violates/);

    // Existente: preencher só vazios (telefone), manter nome e sinalizar divergência.
    const ex = ingest(rawEvent({ email: 'existente@example.invalid', tx: 'HP-EX', name: 'Outro Nome' }), 'live');
    const exRun = await processRow(ex.id);
    // Revisão otimista: estado divergente é recusado.
    fail(exRun.statement.replace(/, '[0-9a-f]{32}', /, ", 'revisao-velha', "), /revision_conflict/);
    q(`UPDATE hotmart_events SET status='processing' WHERE id=${lit(ex.id)};`);
    assert.equal(qj(exRun.statement).status, 'applied', 'divergência cadastral não deixa o evento em revisão');
    const exUser = qj(`SELECT to_jsonb(u) FROM users u WHERE id='${existing}';`);
    assert.deepEqual([exUser.nome, exUser.telefone], ['Nome Manual', '11900000000']);
    assert.equal(q(`SELECT kind FROM hotmart_reviews WHERE event_row_id=${lit(ex.id)};`), 'profile_divergence');
    assert.equal(grants(existing).comunicacao.expiresAt, '2027-10-21', 'exatamente 365 dias');
    // Nova cobrança com o mesmo nome divergente não duplica a revisão.
    const ex2 = ingest(rawEvent({ email: 'existente@example.invalid', tx: 'HP-EX2', name: 'Outro Nome', created: '2026-10-22T13:00:00Z' }), 'live');
    assert.equal(qj((await processRow(ex2.id)).statement).status, 'applied');
    assert.equal(q(`SELECT count(*) FROM hotmart_reviews WHERE user_id='${existing}' AND kind='profile_divergence' AND status='open';`), '1');

    // Reembolso: corta o que a Hotmart concedeu.
    const refund = ingest(rawEvent({ type: 'PURCHASE_REFUNDED', email: 'existente@example.invalid', tx: 'HP-EX', created: '2026-10-23T12:00:00Z' }), 'live');
    assert.equal(qj((await processRow(refund.id)).statement).status, 'applied');
    // A compra HP-EX2 continua ativa: o acesso efetivo é a maior concessão ativa.
    assert.equal(q(`SELECT status FROM hotmart_purchases WHERE purchase_key='tx:HP-EX';`), 'revoked');
    assert.equal(grants(existing).comunicacao.expiresAt, '2028-10-20');
    // Aprovação antiga (corpo diferente) chegando depois é processada, mas não regride.
    const late = ingest(rawEvent({ email: 'existente@example.invalid', tx: 'HP-EX', created: '2026-10-21T12:00:00Z', offer: 'off1' }), 'live');
    assert.equal(late.duplicate, false);
    const beforeLate = grants(existing);
    assert.ok(['ignored', 'review'].includes(qj((await processRow(late.id)).statement).status));
    assert.deepEqual(grants(existing), beforeLate);
    assert.equal(q(`SELECT status FROM hotmart_purchases WHERE purchase_key='tx:HP-EX';`), 'revoked');
    // Reembolso que chega ANTES da aprovação (reenvio atrasado): comprador novo não é criado.
    const pre = ingest(rawEvent({ type: 'PURCHASE_REFUNDED', email: 'pre@example.invalid', tx: 'HP-PRE', created: '2026-10-25T12:00:00Z' }), 'live');
    assert.equal(qj((await processRow(pre.id)).statement).status, 'ignored');
    const preApproval = ingest(rawEvent({ email: 'pre@example.invalid', tx: 'HP-PRE', created: '2026-10-22T12:00:00Z' }), 'live');
    assert.equal(qj((await processRow(preApproval.id)).statement).status, 'review');
    assert.equal(q("SELECT count(*) FROM users WHERE email='pre@example.invalid';"), '0');
    assert.equal(q(`SELECT kind FROM hotmart_reviews WHERE event_row_id=${lit(preApproval.id)};`), 'grant_after_revocation');

    // Plano global legado: compra converte preservando as outras IAs; reembolso mantém manual e vai para revisão.
    const leg = ingest(rawEvent({ email: 'legado@example.invalid', tx: 'HP-LEG', name: 'Legado n8n', phone: '11 90000-0001' }), 'live');
    assert.equal(qj((await processRow(leg.id)).statement).status, 'applied');
    const legUser = qj(`SELECT to_jsonb(u) FROM users u WHERE id='${legacy}';`);
    assert.deepEqual([legUser.plano, legUser.data_expiracao], ['Personalizado', null]);
    assert.deepEqual(grants(legacy), { comunicacao: { enabled: true, expiresAt: '2028-06-29' }, apresentacao: { enabled: true, expiresAt: '2028-06-29' }, conversas_dificeis: { enabled: true, expiresAt: '2027-06-30' }, postagem: { enabled: true, expiresAt: '2027-06-30' } });
    const legRefund = ingest(rawEvent({ type: 'PURCHASE_REFUNDED', email: 'legado@example.invalid', tx: 'HP-LEG', created: '2026-10-24T12:00:00Z' }), 'live');
    assert.equal(qj((await processRow(legRefund.id)).statement).status, 'review');
    assert.deepEqual(grants(legacy).comunicacao, { enabled: true, expiresAt: '2027-06-30' }, 'volta ao acesso manual anterior');
    const [review] = qj(`SELECT public.hotmart_admin_read('${admin}','reviews');`).filter(r => r.kind === 'manual_access_kept');
    assert.ok(review);
    // Admin aceita: plano recalculado pelo TS sobre o estado atual.
    const detail = qj(`SELECT public.hotmart_admin_read('${admin}','review', ${json({ id: review.id })});`);
    const acceptPlan = rules.planReviewAcceptance(detail.proposal, detail.user);
    fail(`SELECT public.hotmart_admin_resolve_review('${existing}', ${lit(review.id)}, 'accept', 'Nao admin', ${lit(detail.user.revision)}, ${json(acceptPlan)});`, /forbidden/);
    q(`SELECT public.hotmart_admin_resolve_review('${admin}', ${lit(review.id)}, 'accept', 'Reembolso confirmado', ${lit(detail.user.revision)}, ${json(acceptPlan)});`);
    assert.deepEqual(grants(legacy).comunicacao, { enabled: false, expiresAt: null });
    assert.deepEqual(grants(legacy).postagem, { enabled: true, expiresAt: '2027-06-30' }, 'IA fora da oferta preservada');
    fail(`SELECT public.hotmart_admin_resolve_review('${admin}', ${lit(review.id)}, 'keep', 'De novo', NULL, NULL);`, /review_closed/);
    assert.equal(q(`SELECT actor_id FROM admin_user_audit WHERE user_id='${legacy}' AND action='hotmart_review_accepted';`), admin);

    // Oferta não mapeada: revisão + stub visível na tela, nada criado.
    const beforeUnmapped = counts();
    const um = ingest(rawEvent({ email: 'outro@example.invalid', tx: 'HP-UM', offer: 'off-desconhecida' }), 'live');
    assert.equal(qj((await processRow(um.id)).statement).status, 'review');
    assert.equal(counts().users, beforeUnmapped.users);
    assert.equal(q(`SELECT source FROM hotmart_offers WHERE offer_code='off-desconhecida';`), 'webhook');
    // Commit sem reserva é recusado.
    fail(`SELECT public.hotmart_commit_event(${lit(um.id)}, NULL, ${json({ outcome: 'ignored', reviews: [] })});`, /not_claimed/);
    // Recuperação: evento parado aparece em pending e na contagem da tela.
    const stuck = ingest(rawEvent({ email: 'parado@example.invalid', tx: 'HP-STUCK' }), 'live');
    q(`UPDATE hotmart_events SET received_at = now() - interval '1 hour' WHERE id=${lit(stuck.id)};`);
    assert.ok(qj('SELECT public.hotmart_pending_events(10, 5, 20);').includes(stuck.id));
    q(`UPDATE hotmart_events SET attempts = 5 WHERE id=${lit(stuck.id)};`);
    assert.ok(!qj('SELECT public.hotmart_pending_events(10, 5, 20);').includes(stuck.id), 'limite de tentativas');
    q(`UPDATE hotmart_events SET attempts = 1, status='processing', claimed_at = now() - interval '6 minutes' WHERE id=${lit(stuck.id)};`);
    assert.ok(qj('SELECT public.hotmart_pending_events(10, 5, 20);').includes(stuck.id), 'lease vencido é retomado');
    assert.equal(qj(`SELECT public.hotmart_claim_event(${lit(stuck.id)});`).claimed, true);
    assert.ok(!qj('SELECT public.hotmart_pending_events(10, 5, 20);').includes(stuck.id), 'lease ativo não é retomado');
    q(`UPDATE hotmart_events SET status='received', claimed_at=NULL WHERE id=${lit(stuck.id)};`);
    fail("SELECT public.hotmart_pending_events(0, 5, 20);", /invalid_input/);
    q(`SELECT public.hotmart_open_review(${lit(live.id)}, ${lit(created.userId)}, 'invite_failed', '{"reason":"email_disabled"}'::jsonb);`);
    fail(`SELECT public.hotmart_open_review(${lit(live.id)}, ${lit(created.userId)}, 'unmapped_offer', '{}'::jsonb);`, /invalid_input/);
    const summary = qj(`SELECT public.hotmart_admin_read('${admin}','summary');`);
    assert.ok(summary.openReviews >= 2);
    assert.ok(summary.stuckEvents >= 1);
    console.log('PostgreSQL isolado: todas as verificações Hotmart passaram');
  } finally {
    if (started) cli(['rm', '-f', name]);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
