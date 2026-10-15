const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fs, path, root, load } = require('./helpers.cjs');

const { getAdminUsersMode, requireAdminUsersDemo } = load('config');

test('admin user demo is disabled by default and cannot run in production', () => {
  const original = { mode: process.env.ADMIN_USERS_MODE, nodeEnv: process.env.NODE_ENV };
  try {
    delete process.env.ADMIN_USERS_MODE;
    process.env.NODE_ENV = 'development';
    assert.equal(getAdminUsersMode(), 'disabled');
    assert.throws(() => requireAdminUsersDemo(), error => error.status === 503);
    process.env.ADMIN_USERS_MODE = 'demo';
    assert.equal(getAdminUsersMode(), 'demo');
    assert.doesNotThrow(() => requireAdminUsersDemo());
    process.env.NODE_ENV = 'production';
    assert.equal(getAdminUsersMode(), 'disabled');
    assert.throws(() => requireAdminUsersDemo(), error => error.status === 503);
    process.env.NODE_ENV = 'development';
    process.env.ADMIN_USERS_MODE = 'live';
    assert.equal(getAdminUsersMode(), 'disabled');
  } finally {
    if (original.mode === undefined) delete process.env.ADMIN_USERS_MODE;
    else process.env.ADMIN_USERS_MODE = original.mode;
    if (original.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original.nodeEnv;
  }
});

test('demo domain stays independent of persistence, mail, and password services', () => {
  const domain = fs.readFileSync(path.join(root, 'src/lib/admin-users/domain.ts'), 'utf8');
  assert.doesNotMatch(domain, /(?:from\s+|require\()['"](?:@\/lib\/)?(?:.*supabase|.*nodemailer|.*smtp|.*password)/i);
  assert.doesNotMatch(domain, /\b(?:fetch|sendMail|sendEmail|updatePassword|bcrypt)\s*\(/i);
});
