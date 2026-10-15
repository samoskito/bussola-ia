// Synthetic browser regression fixture. No credentials, database or external requests.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const currentPolicy = () => {
  const middleware = fs.readFileSync(path.resolve(__dirname, '../../src/middleware.ts'), 'utf8');
  const value = middleware.match(/response\.headers\.set\('Referrer-Policy', '([^']+)'\)/)?.[1];
  if (!value) throw Error('Consent document policy missing');
  return value;
};
const server = http.createServer((req, res) => {
  if (req.url === '/result' && req.method === 'POST') {
    req.resume(); req.on('end', () => {
      const expected = 'http://' + req.headers.host;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ origin: req.headers.origin ?? null, expected, accepted: req.headers.origin === expected }));
    }); return;
  }
  if (!['/original', '/current'].includes(req.url)) { res.writeHead(404); res.end(); return; }
  const policy = req.url === '/original' ? 'no-referrer' : currentPolicy();
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': policy, 'Cache-Control': 'no-store' });
  res.end('<!doctype html><html lang="pt-BR"><title>Teste sintético do consentimento</title><h1>Política: ' + policy + '</h1><p>Sem conexão ao banco ou OAuth real.</p><form method="post" action="/result"><input name="csrf" type="hidden" value="synthetic"><button>Enviar formulário sintético</button></form></html>');
});
server.listen(0, '127.0.0.1', () => console.log(JSON.stringify({ url: 'http://127.0.0.1:' + server.address().port })));
