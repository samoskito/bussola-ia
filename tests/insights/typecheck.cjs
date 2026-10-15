const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'../..');
const configPath=path.join(root,'tsconfig.json');
const config=ts.readConfigFile(configPath,ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root,{incremental:false},configPath);
const program=ts.createProgram(parsed.fileNames,parsed.options);
const diagnostics=ts.getPreEmitDiagnostics(program);
const affected=diagnostics.filter(d=>d.file&&/[\\/]insights[\\/]|[\\/]layout[\\/](Sidebar|MobileMenu)\.tsx$|[\\/]profile[\\/]page\.tsx$/.test(d.file.fileName));
for(const d of affected){const pos=d.file.getLineAndCharacterOfPosition(d.start||0);console.error(`${path.relative(root,d.file.fileName)}:${pos.line+1}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);}
console.log(JSON.stringify({insightsAndTouchedUiDiagnostics:affected.length,otherProjectDiagnostics:diagnostics.length-affected.length,globalTypecheckPassed:diagnostics.length===0}));
process.exitCode=affected.length?1:0;
