const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../insights/helpers.cjs');
const { safeLoginRedirect, resumeOAuthLogin } = require('../../src/lib/auth-redirect.ts');
test('OAuth login resumes only same-origin paths', () => {
  const path = '/api/insights-mcp/oauth/authorize?client_id=claude&state=synthetic';
  assert.equal(safeLoginRedirect(path), path);
  for (const hostile of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/\nevil', ' /dashboard', '/x/..//evil.example', '/.%2e//evil.example']) {
    assert.equal(safeLoginRedirect(hostile), '/dashboard');
  }
});
test('responsive login forms resume an OAuth request only once per document', () => {
  const target = '/api/insights-mcp/oauth/authorize?client_id=claude&state=synthetic';
  const navigations = [];
  resumeOAuthLogin('https://evil.example', path => navigations.push(path));
  resumeOAuthLogin(target, path => navigations.push(path));
  resumeOAuthLogin(target, path => navigations.push(path));
  assert.deepEqual(navigations, [target]);
});
