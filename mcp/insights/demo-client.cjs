'use strict';
// Loopback-only demonstration client. No provider keys, login or .env loading.
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

async function main() {
  if (process.argv.length > 2) throw new Error('Este cliente usa apenas o endpoint demo fixo http://127.0.0.1:8787/mcp.');
  const client = new Client({ name: 'bussola-insights-demo-client', version: '0.1.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8787/mcp')));
    const { tools } = await client.listTools();
    const result = await client.callTool({ name: 'get_insight_summary', arguments: { days: 30, agentType: 'all' } });
    if (result.isError || result.structuredContent?.mode !== 'demo') throw new Error('Resposta de demonstração indisponível.');
    console.log(JSON.stringify({ server: client.getServerVersion(), tools: tools.map(tool => tool.name), report: result.structuredContent }, null, 2));
  } finally { await client.close(); }
}

main().catch(() => { console.error('Não foi possível consultar o MCP demo local. Inicie o servidor HTTP demo na porta 8787.'); process.exitCode = 1; });
