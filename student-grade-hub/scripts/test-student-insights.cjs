const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={};vm.createContext(context);
for(const file of ['site/teacher/analytics.js','apps-script/leadership/StudentInsights.js'])vm.runInContext(fs.readFileSync('student-grade-hub/'+file,'utf8'),context);
const A=context.GradeAnalytics,I=context.StudentInsights;
const raw=JSON.parse(fs.readFileSync('grade_reconciliation/audit-complete-2026-10-29.json','utf8'));
const model=A.normalize(raw),alias=key=>'Alias-'+model.students.findIndex(s=>s.key===key);
for(const s of model.students){
  const report=I.report(raw,s.admission,alias),cohort=model.students.filter(x=>x.section===s.section&&x.rows.length);
  assert.equal(report.normalizedScore,s.overall);assert.equal(report.submitted,s.submitted);assert.equal(report.notSubmitted,s.missing);
  assert.equal(report.insights.section.rank,cohort.filter(x=>x.overall>s.overall).length+1);
  assert.equal(report.insights.overall.rank,model.students.filter(x=>x.rows.length&&x.overall>s.overall).length+1);
  assert(report.activities.every(x=>x.normalizedScore>=0&&x.normalizedScore<=100));
  const boards=[report.insights.leaderboards.overall,report.insights.leaderboards.section,...report.insights.topics.map(t=>t.leaderboard)];
  for(const board of boards)for(const entry of board)assert.deepEqual(Object.keys(entry).sort(),['alias','isYou','rank','score']);
  const peers=model.students.filter(x=>x.key!==s.key);
  const serialized=JSON.stringify(report);
  for(const p of peers){if(p.admission)assert(!serialized.includes(p.admission),'Peer admission leaked');if(p.enrollment)assert(!serialized.includes(p.enrollment),'Peer enrollment leaked');}
  assert(!('ledger' in report));assert(!('students' in report));
  assert(!serialized.includes('Student Visible Feedback'));
}
assert.throws(()=>I.report(raw,'not-real',alias),/No student/);
const ties=Array.from({length:12},(_,i)=>({name:'Student'+i,overall:i<9?100-i:50}));
const ranked=A.rank(ties);assert.equal(ranked.length,12,'Include everyone tied at the tenth position');
assert.equal(ranked[9].rank,10);assert.equal(ranked[11].rank,10);
const shared=A.rank([{name:'A',overall:100},{name:'B',overall:90},{name:'C',overall:90},{name:'D',overall:70}]);
assert.equal(shared.map(s=>s.rank).join(','),'1,2,2,4');
const varun=I.report(raw,'24SCSE1410313',alias);assert.equal(varun.activities.find(a=>a.id==='A03').status,'Submitted');
const noSub=model.students.find(s=>!s.submitted);assert(noSub);assert.equal(I.report(raw,noSub.admission,alias).insights.mastery,null);
assert.match(I.report(raw,noSub.admission,alias).midSemFeedback.improve,/Midterm submissions are closed/);
console.log('Student insights verified for all 105 learners: faculty score/rank agreement, privacy projection, section eligibility, missing work, submitted zero, no evidence, tie ranks and top-10 boundary.');
