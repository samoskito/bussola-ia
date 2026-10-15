const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const configPath = path.join(root, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, { incremental: false }, configPath);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const all = ts.getPreEmitDiagnostics(program);
const touched = all.filter(d => d.file && (
  /[\\/]admin-users[\\/]|[\\/]api[\\/]admin[\\/]users[\\/]|[\\/]dashboard[\\/]users[\\/]|[\\/]auth[\\/]first-access[\\/]|[\\/]auth[\\/]update-password[\\/]demo[\\/]|[\\/]auth[\\/]layout\.client\.tsx$|[\\/]layout[\\/](Sidebar|MobileMenu)\.tsx$/.test(d.file.fileName) ||
  /[\\/](agent-access|access-date|middleware)\.ts$|[\\/]api[\\/]auth[\\/]reset-password[\\/]route\.ts$/.test(d.file.fileName)
));
for (const d of touched) {
  const pos = d.file.getLineAndCharacterOfPosition(d.start || 0);
  console.error(`${path.relative(root, d.file.fileName)}:${pos.line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
}
console.log(JSON.stringify({ adminUsersAndNavDiagnostics: touched.length, otherProjectDiagnostics: all.length - touched.length, globalPassed: all.length === 0 }));
process.exitCode = touched.length ? 1 : 0;
