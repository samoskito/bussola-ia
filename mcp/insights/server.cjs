'use strict';

const http = require('node:http');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { VERSION, registerDemoTools } = require('./tools.cjs');

const MAX_BODY_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 10000;

function assertDemoMode(env = process.env) {
  if (env.MCP_INSIGHTS_MODE !== 'demo' || env.NODE_ENV === 'production') {
    throw new Error('MCP local exige MCP_INSIGHTS_MODE=demo e não pode executar em produção.');
  }
}

function createDemoMcpServer({ now = () => new Date(), env = process.env } = {}) {
  assertDemoMode(env);
  const server = new McpServer({ name: 'bussola-insights-demo', version: VERSION }, {
    instructions: 'Somente leitura de dados inteiramente simulados. Não consulta banco, não classifica mensagens reais e não inicia processos pagos. As contagens são mensagens e não demandas únicas; temas podem se sobrepor.',
  });
  registerDemoTools(server, { now });
  return server;
}

function sendLocalError(res, status, code) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ mode: 'demo', error: code }));
}

function readBody(req, res) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => {
      sendLocalError(res, 408, 'request_timeout');
      finish(new Error('request_timeout'));
      req.resume();
    }, REQUEST_TIMEOUT_MS);
    req.on('data', chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        sendLocalError(res, 413, 'body_too_large');
        finish(new Error('body_too_large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { sendLocalError(res, 400, 'invalid_json'); finish(new Error('invalid_json')); }
    });
    req.on('error', () => finish(new Error('request_failed')));
    req.on('aborted', () => finish(new Error('request_aborted')));
  });
}

async function startDemoHttpServer(options = {}) {
  if (Object.keys(options).some(key => !['port', 'now', 'env'].includes(key))) {
    throw new Error('Opção HTTP desconhecida; o endereço é fixo em 127.0.0.1.');
  }
  const { port = 8787, now = () => new Date(), env = process.env } = options;
  assertDemoMode(env);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Porta inválida.');
  const active = new Set();
  let boundPort;
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    // Exact literal allowlist avoids DNS resolution, forwarding headers and rebinding.
    const allowedHosts = [`127.0.0.1:${boundPort}`, `localhost:${boundPort}`];
    const countHeader = name => req.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === name).length;
    const host = req.headers.host;
    if (countHeader('host') !== 1 || !allowedHosts.includes(host)) {
      req.resume(); sendLocalError(res, 403, 'host_not_allowed'); return;
    }
    const origin = req.headers.origin;
    if (countHeader('origin') > 1 || (origin !== undefined && origin !== `http://${host}`)) {
      req.resume(); sendLocalError(res, 403, 'origin_not_allowed'); return;
    }
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ mode: 'demo', version: VERSION })); return;
    }
    if (req.url !== '/mcp') {
      req.resume(); sendLocalError(res, 404, 'not_found'); return;
    }
    if (req.method !== 'POST') {
      req.resume(); res.setHeader('Allow', 'POST'); sendLocalError(res, 405, 'method_not_allowed'); return;
    }
    if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) {
      req.resume(); sendLocalError(res, 415, 'json_required'); return;
    }
    const declaredLength = req.headers['content-length'];
    if (declaredLength !== undefined && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES)) {
      req.resume(); sendLocalError(res, 413, 'body_too_large'); return;
    }
    let mcp;
    try {
      const body = await readBody(req, res);
      // SDK owns protocol validation/negotiation. Each stateless request gets a fresh instance.
      mcp = createDemoMcpServer({ now, env });
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, enableJsonResponse: true,
        enableDnsRebindingProtection: true, allowedHosts, allowedOrigins: allowedHosts.map(value => `http://${value}`),
      });
      active.add(mcp);
      res.once('close', () => { active.delete(mcp); mcp.close().catch(() => {}); });
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch {
      sendLocalError(res, 500, 'local_mcp_failed');
      if (mcp) { active.delete(mcp); await mcp.close().catch(() => {}); }
    }
  });
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = REQUEST_TIMEOUT_MS;
  server.keepAliveTimeout = 1000;
  server.timeout = REQUEST_TIMEOUT_MS + 1000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      boundPort = server.address().port;
      resolve();
    });
  });
  let closePromise;
  function close() {
    if (!closePromise) closePromise = (async () => {
      await Promise.allSettled([...active].map(item => item.close()));
      await new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections();
      });
    })();
    return closePromise;
  }
  return { server, port: boundPort, url: `http://127.0.0.1:${boundPort}/mcp`, close };
}

function parseCli(argv) {
  let transport = 'stdio';
  let port = 8787;
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === '--transport' && ['stdio', 'http'].includes(argv[index + 1])) transport = argv[++index];
    else if (flag === '--port' && /^\d+$/.test(argv[index + 1] || '')) port = Number(argv[++index]);
    else throw new Error('Use --transport stdio|http e, para HTTP, --port 1..65535. Endereço fixo: 127.0.0.1.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Porta CLI deve estar entre 1 e 65535.');
  return { transport, port };
}

async function main() {
  assertDemoMode();
  const options = parseCli(process.argv.slice(2));
  const now = process.env.NODE_ENV === 'test' && process.env.MCP_INSIGHTS_TEST_NOW
    ? () => new Date(process.env.MCP_INSIGHTS_TEST_NOW) : () => new Date();
  if (options.transport === 'stdio') {
    const server = createDemoMcpServer({ now });
    await server.connect(new StdioServerTransport());
    return;
  }
  const instance = await startDemoHttpServer({ port: options.port, now });
  process.stderr.write(`MCP Insights demo local: ${instance.url}\n`);
  const stop = () => instance.close().then(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (require.main === module) main().catch(() => {
  process.stderr.write('MCP Insights não iniciado: exige modo demo fora de produção e opções locais válidas.\n');
  process.exitCode = 1;
});

module.exports = { createDemoMcpServer, startDemoHttpServer, assertDemoMode, MAX_BODY_BYTES, REQUEST_TIMEOUT_MS };
