/** Staff-only snapshot. Active identity is checked, never the execution owner. */
function requireGradeHubStaff_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const allowed = ['bipul.kumar1@galgotiasuniversity.edu.in'];
  if (!email || allowed.indexOf(email) === -1) throw new Error('Teacher access required. Sign in with your faculty Google account.');
  return email;
}

function teacherDashboard_() {
  requireGradeHubStaff_();
  const html = UrlFetchApp.fetch('https://vipulshahi-ai.github.io/student-grade-hub/teacher/index.html').getContentText();
  return HtmlService.createHtmlOutput(html).setTitle('Soft Computing · Faculty Analytics');
}

function showTeacherDashboard() {
  requireGradeHubStaff_();
  SpreadsheetApp.getUi().showModalDialog(teacherDashboard_().setWidth(1300).setHeight(850), 'Faculty Analytics');
}

function getTeacherData() {
  requireGradeHubStaff_();
  const ss = SpreadsheetApp.openById(GRADE_HUB.spreadsheetId);
  const table = name => {const sheet=ss.getSheetByName(name);return sheet ? sheet.getDataRange().getDisplayValues() : [];};
  const students = table('Students');
  const activities = table('Activities');
  const ledger = table('Student_Activity');
  const topics = table('Teacher_Topics');
  const queries = table('Grade_Queries');
  const checks = [];
  const index = new Map();
  records_(ss.getSheetByName('Student_Activity')).forEach(row=>index.set(row['Student Key']+'|'+row['Activity ID'],row));
  let sourceDifferences=0;
  records_(ss.getSheetByName('Activities')).forEach(activity=>{
    const source=ss.getSheetByName(String(activity['Grading Tab']));
    if (!source) return;
    records_(source).forEach(row=>{const ledgerRow=index.get(row['Student Key']+'|'+activity['Activity ID']);
      if (!ledgerRow || Number(row.Marks)!==Number(ledgerRow.Marks) || row.Status!==ledgerRow.Status || String(row['Student Visible Feedback']||'')!==String(ledgerRow['Student Visible Feedback']||'')) sourceDifferences++;
    });
  });
  checks.push({label:'Activity tabs → student ledger',result:sourceDifferences+' differences in marks, status or feedback',at:new Date().toISOString()});
  const auditSheet=ss.getSheetByName('Teacher_Audit');
  if(auditSheet) records_(auditSheet).forEach(row=>checks.push({label:row.Check,result:row.Result,at:row['Checked At']}));
  return {students,activities,ledger,topics,queries,generatedAt:new Date().toISOString(),audit:{checks}};
}
