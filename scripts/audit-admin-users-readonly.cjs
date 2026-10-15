// GET-only schema/preflight audit. No secrets, raw emails, passwords or IDs saved.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const env = dotenv.parse(fs.readFileSync(path.join(root, '.env.local')));
const base = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co')) throw new Error('Unexpected Supabase host');
const key = env.SUPABASE_SERVICE_ROLE_KEY;
async function get(resource, params = {}, metadata = false) {
  const url = new URL('/rest/v1/' + resource, base);
  Object.entries(params).forEach(([name,value]) => url.searchParams.set(name, String(value)));
  const result = await fetch(url, { method: 'GET', headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: metadata ? 'application/openapi+json' : 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!result.ok) throw new Error('Read-only preflight failed HTTP ' + result.status);
  return result.json();
}
(async () => {
  const schema = await get('', {}, true);
  const tables = {};
  for (const name of ['users','user_agent_access','password_reset_tokens']) {
    const definition = schema.definitions?.[name];
    tables[name] = { present: !!definition, columns: Object.fromEntries(Object.entries(definition?.properties || {}).map(([column,description]) => [column, {type:description.type, format:description.format}])) };
  }
  const counts = new Map(); let users = 0, missingEmail = 0, blankEmail = 0, complete = false;
  for (let offset = 0; offset < 20000; offset += 500) {
    const rows = await get('users', { select:'email', order:'id.asc', offset, limit:500 });
    for (const row of rows) {
      users++;
      if (row.email === null) {missingEmail++; continue;}
      const normalized = row.email.trim().toLowerCase();
      if (!normalized) blankEmail++;
      counts.set(normalized, (counts.get(normalized) || 0)+1);
    }
    if (rows.length < 500) {complete=true; break;}
  }
  const report = { timestamp:new Date().toISOString(), method:'GET only', writes:0, tables, identity:{users,complete,missingEmail,blankEmail,normalizedDuplicateGroups:[...counts.values()].filter(count=>count>1).length}, emailConfiguration:{smtpHost:!!env.SMTP_HOST,smtpUser:!!env.SMTP_USER,smtpPass:!!env.SMTP_PASS,smtpFrom:!!env.SMTP_FROM,brevoApiKey:!!env.BREVO_API_KEY}, limitations:['Policies, triggers, constraints and SQL privileges not inspected by Data API metadata.','No actual mail delivery or database mutation tested.'] };
  const suffix = process.argv.includes('--after-reconciliation') ? '-after-reconciliation' : '';
  fs.writeFileSync(path.join(root,`docs/audits/2026-10-15-admin-users-readonly${suffix}.json`),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
