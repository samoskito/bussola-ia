const { test } = require('node:test');
const assert = require('node:assert/strict');
const { path, root } = require('./helpers.cjs');
const { hasAccessDateExpired } = require(path.join(root, 'src/lib/access-date.ts'));
test('chat access dates agree with panel inclusive Sao Paulo expiry', () => {
  assert.equal(hasAccessDateExpired('2026-10-15', new Date('2026-10-16T02:59:59Z')), false);
  assert.equal(hasAccessDateExpired('2026-10-15', new Date('2026-10-16T03:00:00Z')), true);
  assert.equal(hasAccessDateExpired('2026-10-15', new Date('2026-10-15T03:00:00Z')), false);
  assert.equal(hasAccessDateExpired(null), false);
  assert.equal(hasAccessDateExpired('2026-02-31'), true);
});
