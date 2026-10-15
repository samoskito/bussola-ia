const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../insights/helpers.cjs');
const { NextRequest } = require('next/server');
const { middleware } = require('../../src/middleware.ts');
test('consent document supports native same-origin form posts without cross-origin referrer disclosure', async () => {
  const response = await middleware(new NextRequest('https://example.invalid/auth/insights-mcp'));
  assert.equal(response.headers.get('Referrer-Policy'), 'same-origin');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.equal(response.headers.get('Content-Security-Policy'), "frame-ancestors 'none'");
});
