const {test} = require('node:test');
const assert = require('node:assert/strict');
const {load,source} = require('./helpers.cjs');
const {buildDemoReport} = load('report');
const {csvCell,reportToCsv} = load('service');
const classification=(topicIds=['feedback'])=>({kind:'initial_request',topicIds,normalizedDemand:'Preparar feedback sobre entregas.',confidence:.9,needsReview:false});
const rows=[
 {...source(),status:'classified',classification:classification()},
 {...source({id:2}),status:'classified',classification:{...classification(),kind:'refinement'}},
 {...source({id:3,userId:'person-B',chatId:'chat-B'}),status:'classified',classification:classification(['feedback','conflitos'])},
 {...source({id:4,userId:'person-B',chatId:'chat-B'}),status:'pending'},
 {...source({id:5,userId:'person-C',chatId:'chat-C'}),status:'failed'},
 {...source({id:6,userId:'admin',chatId:'admin-chat',userLevel:'admin',input:'ADMIN_PRIVATE_INPUT'}),status:'classified',classification:{...classification(),normalizedDemand:'ADMIN_PRIVATE_DERIVED'}},
];
test('report excludes admins before metrics/examples and counts people rather than repeated turns',()=>{
 const report=buildDemoReport({days:30,agentType:'all'},new Date('2026-10-14T21:00:00Z'),rows);
 assert.deepEqual(report.summary,{eligibleMessages:5,classifiedMessages:3,pendingMessages:1,failedMessages:1,excludedAdminMessages:1,distinctUsers:3,distinctChats:3,coveragePercent:60});
 const feedback=report.topics.find(t=>t.id==='feedback');
 assert.equal(feedback.messages,3);assert.equal(feedback.distinctUsers,2);assert.equal(feedback.distinctChats,2);
 assert.equal(report.topics.find(t=>t.id==='conflitos').sharePercent,33.3);
 const serialized=JSON.stringify(report);
 for(const marker of ['ADMIN_PRIVATE','synthetic-user','person-B','person-C','synthetic-chat','admin-chat'])assert.ok(!serialized.includes(marker));
 assert.equal(report.mode,'demo');
 assert.match(report.processing.scheduleLabel,/ainda não ativada/);
 assert.equal(report.trend.reduce((n,day)=>n+day.messages,0),5);
});
test('agent/topic filters preserve coverage of the period and do not label unknown pending items',()=>{
 const report=buildDemoReport({days:30,agentType:'comunicacao',topicId:'conflitos'},new Date('2026-10-14T21:00:00Z'),rows);
 assert.equal(report.summary.eligibleMessages,5);assert.equal(report.summary.coveragePercent,60);
 assert.equal(report.topics.length,1);assert.equal(report.examples.length,1);
 assert.equal(report.trend.reduce((n,d)=>n+d.messages,0),1);
 const empty=buildDemoReport({days:30,agentType:'postagem'},new Date('2026-10-14T21:00:00Z'),rows);
 assert.equal(empty.summary.eligibleMessages,0);assert.equal(empty.summary.coveragePercent,0);
});
test('CSV neutralizes formulas and exports simulation label without source text or IDs',()=>{
 for(const value of ['=SUM(1,2)',' +123','\t@evil','-1'])assert.ok(csvCell(value).startsWith('"\''));
 assert.equal(csvCell('a"b'),'"a""b"');
 const csv=reportToCsv(buildDemoReport({days:30,agentType:'all'},new Date('2026-10-14T21:00:00Z'),rows));
 assert.ok(csv.includes('"demo"'));assert.ok(!csv.includes('ADMIN_PRIVATE'));assert.ok(!csv.includes('synthetic-user'));
});
