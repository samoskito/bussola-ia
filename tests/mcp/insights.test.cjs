const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');

// Resolve the MCP SDK from the isolated connector package, never the Next app.
const connector = path.resolve(__dirname, '../../mcp/insights');
const connectorRequire = createRequire(path.join(connector, 'package.json'));
const { Client } = connectorRequire('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = connectorRequire('@modelcontextprotocol/sdk/inMemory.js');
const { StreamableHTTPClientTransport } = connectorRequire('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { StdioClientTransport } = connectorRequire('@modelcontextprotocol/sdk/client/stdio.js');
const { createDemoMcpServer, startDemoHttpServer } = require('../../mcp/insights/server.cjs');

const fixedNow = () => new Date('2026-10-14T21:00:00.000Z');
const demoEnv = Object.freeze({ MCP_INSIGHTS_MODE: 'demo', NODE_ENV: 'test' });
const makeClient = () => new Client({ name: 'bussola-insights-contract-test', version: '1.0.0' });
const TOOL = Object.freeze({
  summary: 'get_insight_summary',
  topics: 'list_demand_topics',
  trend: 'get_topic_trend',
  examples: 'get_topic_examples',
  compare: 'compare_insight_periods',
});
const TOOL_NAMES = Object.values(TOOL);

function report(result) {
  assert.notEqual(result.isError, true, JSON.stringify(result));
  const text = result.content?.find(block => block.type === 'text')?.text;
  assert.equal(typeof text, 'string', 'tool must return JSON text for MCP clients');
  const data = JSON.parse(text);
  assert.equal(data.mode, 'demo');
  assert.equal(data.generatedAt, fixedNow().toISOString());
  return data;
}

async function call(client, name, args = {}) {
  return report(await client.callTool({ name, arguments: args }));
}

async function rejectsBadArguments(client, name, args) {
  try {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, true, `${name} accepted ${JSON.stringify(args)}`);
  } catch (error) {
    assert.match(String(error), /invalid|argument|parameter|parse|400|32602|not found|unknown/i);
  }
}

async function withMemoryClient(run) {
  const server = createDemoMcpServer({ now: fixedNow, env: demoEnv });
  const client = makeClient();
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

test('SDK in-memory handshake exposes exactly five read-only insight tools', async () => {
  await withMemoryClient(async client => {
    const version = client.getServerVersion();
    assert.ok(version?.name);
    const { tools } = await client.listTools();
    assert.equal(tools.length, 5);
    assert.deepEqual(tools.map(tool => tool.name).sort(), TOOL_NAMES.slice().sort());
    for (const tool of tools) {
      assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} needs readOnlyHint`);
      assert.equal(tool.annotations?.destructiveHint, false, `${tool.name} must be nondestructive`);
      assert.equal(tool.inputSchema?.type, 'object');
      assert.equal(tool.inputSchema?.additionalProperties, false, `${tool.name} must reject unknown fields`);
    }
  });
});

test('SDK tools align period, filters, counts, and admin privacy', async () => {
  await withMemoryClient(async client => {
    const summary = await call(client, TOOL.summary, { days: 30, agentType: 'all' });
    assert.deepEqual(summary.filters, { days: 30, agentType: 'all' });
    assert.equal(summary.window.timezone, 'America/Sao_Paulo');
    assert.equal(summary.summary.eligibleMessages, 160);
    assert.equal(summary.summary.excludedAdminMessages, 3);
    assert.equal(summary.summary.distinctChats, 120);
    assert.equal(summary.summary.distinctUsers, 19);

    for (const days of [7, 30, 90]) {
      const data = await call(client, TOOL.summary, { days, agentType: 'all' });
      assert.equal(data.filters.days, days);
      assert.equal(data.summary.eligibleMessages, 4 * days + 4 * Math.ceil(days / 3));
      assert.equal(data.summary.distinctChats, 4 * days);
      assert.equal(data.summary.excludedAdminMessages, Math.ceil(days / 10));
    }

    for (const agentType of ['comunicacao', 'apresentacao', 'conversas_dificeis', 'postagem']) {
      const data = await call(client, TOOL.summary, { days: 30, agentType });
      assert.equal(data.filters.agentType, agentType);
      assert.equal(data.summary.eligibleMessages, 40);
    }

    const topics = await call(client, TOOL.topics, { days: 30, agentType: 'all' });
    const trend = await call(client, TOOL.trend, { days: 30, agentType: 'all', topicId: 'feedback' });
    const examples = await call(client, TOOL.examples, { days: 30, agentType: 'all', topicId: 'feedback', limit: 3 });
    const comparison = await call(client, TOOL.compare, { days: 30, agentType: 'all', topicId: 'feedback' });
    for (const data of [topics, trend, examples, comparison]) {
      assert.deepEqual(data.window, summary.window);
      assert.equal(data.filters.days, 30);
      assert.equal(data.filters.agentType, 'all');
      assert.ok(!JSON.stringify(data).includes('EXCLUIR ADMIN'));
      assert.ok(!JSON.stringify(data).includes('synthetic-person-'));
      assert.ok(!JSON.stringify(data).includes('synthetic-chat-'));
      assert.ok(!JSON.stringify(data).includes('synthetic-admin'));
    }
    assert.ok(topics.topics.some(topic => topic.id === 'feedback' && topic.messages > 0));
    assert.equal(trend.trend.length, 30);
    assert.ok(examples.examples.length > 0 && examples.examples.length <= 3);
    assert.ok(examples.examples.every(example => example.topicId === 'feedback'));
    assert.ok(comparison.current && comparison.previous);
    assert.deepEqual(comparison.current.window, summary.window);
    assert.equal(comparison.current.summary.eligibleMessages, summary.summary.eligibleMessages);
    assert.equal(Date.parse(comparison.previous.window.end) + 30 * 86400000, Date.parse(comparison.current.window.end));
    assert.equal(Date.parse(comparison.previous.window.start) + 30 * 86400000, Date.parse(comparison.current.window.start));
    for (const item of comparison.changes) {
      assert.equal(item.messageDelta, item.currentMessages - item.previousMessages);
      assert.equal(item.distinctUsersDelta, item.currentDistinctUsers - item.previousDistinctUsers);
    }
  });
});

test('SDK rejects unknown, invalid, and write-shaped tool arguments', async () => {
  await withMemoryClient(async client => {
    await rejectsBadArguments(client, TOOL.summary, { days: 31 });
    await rejectsBadArguments(client, TOOL.summary, { days: '30' });
    await rejectsBadArguments(client, TOOL.summary, { agentType: 'unknown' });
    await rejectsBadArguments(client, TOOL.topics, { topicId: 'not-a-topic' });
    await rejectsBadArguments(client, TOOL.examples, { limit: 0 });
    await rejectsBadArguments(client, TOOL.examples, { limit: 13 });
    await rejectsBadArguments(client, TOOL.summary, { userId: 'private' });
    await rejectsBadArguments(client, TOOL.summary, { mutate: true });
    await rejectsBadArguments(client, TOOL.trend, {});
    await rejectsBadArguments(client, 'delete_insights', {});
  });
});

test('demo factory fails closed in production and live modes', async () => {
  for (const env of [
    { MCP_INSIGHTS_MODE: 'demo', NODE_ENV: 'production' },
    { MCP_INSIGHTS_MODE: 'live', NODE_ENV: 'test' },
    { MCP_INSIGHTS_MODE: 'disabled', NODE_ENV: 'test' },
  ]) {
    assert.throws(() => createDemoMcpServer({ now: fixedNow, env }));
    await assert.rejects(async () => startDemoHttpServer({ port: 0, now: fixedNow, env }));
  }
});

test('official Streamable HTTP client handshakes and local endpoint rejects hostile requests', async () => {
  const instance = await startDemoHttpServer({ port: 0, now: fixedNow, env: demoEnv });
  const client = makeClient();
  const endpoint = new URL(instance.url);
  assert.equal(endpoint.hostname, '127.0.0.1');
  const transport = new StreamableHTTPClientTransport(endpoint, {
    fetch: (url, init) => {
      assert.equal(new URL(url).hostname, '127.0.0.1');
      return fetch(url, init);
    },
  });
  let stage = 'SDK connect';
  try {
    await client.connect(transport);
    stage = 'SDK list tools';
    assert.equal((await client.listTools()).tools.length, 5);
    stage = 'SDK summary';
    assert.equal((await call(client, TOOL.summary, { days: 7 })).summary.eligibleMessages, 40);

    stage = 'hostile origin';
    const hostileOrigin = await fetch(endpoint, { method: 'POST', headers: { Origin: 'https://outside.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.ok(hostileOrigin.status >= 400);
    assert.notEqual(hostileOrigin.headers.get('access-control-allow-origin'), '*');
    stage = 'hostile host';
    const hostileHost = await fetch(endpoint, { method: 'POST', headers: { Host: 'outside.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.ok(hostileHost.status >= 400);
    stage = 'oversized body';
    const oversized = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(1024 * 1024 + 1) });
    assert.ok(oversized.status === 413 || oversized.status === 400);
    stage = 'unknown route';
    const route = await fetch(new URL('/unknown', endpoint));
    assert.equal(route.status, 404);
    stage = 'unsupported GET';
    const get = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    assert.ok(get.status === 405 || get.status === 400);
    assert.notEqual(get.headers.get('access-control-allow-origin'), '*');
  } catch (error) {
    throw new Error(`HTTP stage ${stage}: ${error.message}; ${error.cause?.message || ''}`, { cause: error });
  } finally {
    await client.close().catch(() => {});
    await instance.close();
  }
});

test('official stdio client spawns isolated synthetic demo and exits cleanly', async () => {
  const client = makeClient();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(connector, 'server.cjs'), '--transport', 'stdio'],
    cwd: connector,
    env: {
      PATH: process.env.PATH || '',
      MCP_INSIGHTS_MODE: 'demo',
      NODE_ENV: 'test',
      MCP_INSIGHTS_TEST_NOW: fixedNow().toISOString(),
    },
    stderr: 'pipe',
  });
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 5);
    const data = await call(client, TOOL.summary, { days: 30, agentType: 'all' });
    assert.equal(data.summary.eligibleMessages, 160);
  } finally {
    await client.close();
  }
});
