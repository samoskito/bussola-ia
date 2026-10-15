'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// No require.extensions hook: only these five reviewed, pure demo sources load.
// Production services, credentials, authentication and database modules cannot resolve.
const projectRoot = path.resolve(__dirname, '../..');
const sourceRoot = path.join(projectRoot, 'src/lib');
const allowed = new Set(['agents', 'insights/report', 'insights/fixtures', 'insights/filters', 'insights/taxonomy']);

function loadDemoReportModules() {
  const ts = require(path.join(projectRoot, 'node_modules/typescript'));
  const cache = new Map();
  class InsightsError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  const errorShim = Object.freeze({ InsightsError });

  function load(id) {
    if (!allowed.has(id)) throw new Error('Importação fora da lista permitida do relatório demo.');
    if (cache.has(id)) return cache.get(id).exports;
    const filename = path.join(sourceRoot, `${id}.ts`);
    const module = { exports: {} };
    cache.set(id, module);
    const source = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, isolatedModules: true },
    }).outputText;
    function localRequire(specifier) {
      if (id === 'insights/filters' && specifier === './config') return errorShim;
      if (!specifier.startsWith('.')) throw new Error('Dependência externa proibida no relatório demo.');
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(id), specifier));
      return load(resolved);
    }
    const wrapper = vm.runInThisContext(`(function(exports, require, module) {\n${compiled}\n})`, { filename });
    wrapper(module.exports, localRequire, module);
    return module.exports;
  }
  return Object.freeze({
    buildDemoReport: load('insights/report').buildDemoReport,
    createDemoFixtures: load('insights/fixtures').createDemoFixtures,
    INSIGHT_TOPICS: load('insights/taxonomy').INSIGHT_TOPICS,
    TAXONOMY_VERSION: load('insights/taxonomy').TAXONOMY_VERSION,
    AGENTS: load('agents').AGENTS,
  });
}

module.exports = { loadDemoReportModules };
