// Local TS test harness: no packages installed and no network allowed.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'server-only') return {};
  if (request.startsWith('@/')) request = path.join(root, 'src', request.slice(2));
  return originalLoad.call(this, request, parent, isMain);
};
require.extensions['.ts'] = function(module, filename) {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};
global.fetch = async () => { throw new Error('Network is prohibited in insights tests'); };
function load(name) { return require(path.join(root, 'src/lib/insights', name + '.ts')); }
function source(overrides = {}) {
  return {id:1,userId:'synthetic-user',chatId:'synthetic-chat',agentType:'comunicacao',input:'Como comunicar metas à equipe?',createdAt:'2026-10-14T12:00:00.000Z',userLevel:'user',...overrides};
}
module.exports = {load, source, root};
