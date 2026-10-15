// Build a disposable source snapshot without reading/copying any .env or private backup.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const target = path.join(root, '.local-backups', `admin-release-build-${new Date().toISOString().replace(/[:.]/g, '-')}`);
if (!target.startsWith(path.join(root, '.local-backups') + path.sep)) throw new Error('Unexpected build destination');
fs.mkdirSync(target, { recursive: true });
for (const directory of ['src', 'public']) fs.cpSync(path.join(root, directory), path.join(target, directory), { recursive: true });
for (const file of ['package.json', 'package-lock.json', 'tsconfig.json', 'next.config.js', 'postcss.config.js', 'postcss.config.mjs', 'tailwind.config.js', 'tailwind.config.ts', 'next-env.d.ts']) {
  const source = path.join(root, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(target, file));
}
fs.symlinkSync(path.join(root, 'node_modules'), path.join(target, 'node_modules'), 'junction');
const env = {};
for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC', 'PATHEXT', 'SystemDrive']) {
  if (process.env[key]) env[key] = process.env[key];
}
Object.assign(env, {
  NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:59999', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-release-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-release-service', JWT_SECRET: 'synthetic-release-build-only-not-a-credential',
  NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:59998',
  ADMIN_USERS_MODE: 'disabled', ADMIN_USERS_LIVE_ENABLED: 'false', ADMIN_USERS_WRITES_ENABLED: 'false', ADMIN_USERS_EMAIL_ENABLED: 'false',
  INSIGHTS_MODE: 'disabled', INSIGHTS_OPENAI_ENABLED: 'false', INSIGHTS_PROCESSING_ENABLED: 'false', INSIGHTS_MAX_SPEND_USD: '0',
});
console.log(JSON.stringify({ isolatedBuild: true, source: root, destination: target, realEnvironmentCopied: false }));
const log = fs.createWriteStream(path.join(target, 'build.log'));
const child = spawn(process.execPath, [path.join(target, 'node_modules/next/dist/bin/next'), 'build'], { cwd: target, env, windowsHide: true });
child.stdout.on('data', chunk => { process.stdout.write(chunk); log.write(chunk); });
child.stderr.on('data', chunk => { process.stderr.write(chunk); log.write(chunk); });
child.on('error', error => { log.end(); console.error(error.message); process.exitCode = 1; });
child.on('close', code => { log.end(); console.log(JSON.stringify({ isolatedBuildExit: code, buildIdPresent: fs.existsSync(path.join(target, '.next/BUILD_ID')) })); process.exitCode = code ?? 1; });
