/** Staff-only snapshot. Active identity is checked, never the execution owner. */
function requireGradeHubStaff_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const allowed = ['bipul.kumar1@galgotiasuniversity.edu.in'];
  if (!email || allowed.indexOf(email) === -1) throw new Error('Teacher access required. Sign in with your faculty Google account.');
  return email;
}

function teacherDashboard_() {
  requireGradeHubStaff_();
  const html = TEACHER_HTML_;
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

const TEACHER_HTML_ = "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Soft Computing · Faculty Analytics</title><link rel=\"stylesheet\" href=\"https://vipulshahi-ai.github.io/student-grade-hub/teacher/teacher.css\"><base target=\"_blank\"></head>\n<body>\n<aside><a class=\"brand\" href=\"#\" target=\"_self\"><span class=\"brand-icon\">∑</span><span>SOFT COMPUTING<small>Faculty workspace</small></span></a><p class=\"nav-label\">ANALYSE</p><nav id=\"insight-nav\"><button data-view=\"overview\" class=\"selected\">◫ <span>Overview</span></button><button data-view=\"topics\">▥ <span>Topic intelligence</span></button><button data-view=\"top\">↗ <span>Top 10 learners</span></button><button data-view=\"engagement\">◉ <span>Participation bands</span></button><button data-view=\"support\">◎ <span>Support priorities</span></button><button data-view=\"gap\">⇄ <span>Quiz–lab gap</span></button><button data-view=\"performance\">◷ <span>Performance levels</span></button><button data-view=\"audit\">☷ <span>Data & grading audit</span></button><button data-view=\"mapping\">⌘ <span>Topic mapping</span></button></nav><div class=\"privacy\">TEACHER VIEW<br><span>Roster and grades are loaded privately. No class dataset is published with this page.</span></div></aside>\n<main><header><div><p class=\"eyebrow\">MIDTERM · SECTIONS 32 & 33</p><h1 id=\"page-title\">Learning, at a glance.</h1><p id=\"page-subtitle\">Explore participation, topic evidence and where support will help.</p></div><div class=\"actions\"><button id=\"refresh\" class=\"primary\">↻ Refresh from sheet</button><button id=\"export\">↓ Export view</button><button id=\"print\">Print</button></div></header>\n<section id=\"connection\" class=\"connection\"><div><strong id=\"connection-state\">Connect your teaching data</strong><p id=\"freshness\">Open the authenticated faculty dashboard for live Google Sheet data, or import a private Grade Hub JSON snapshot.</p></div><label class=\"file-button\">Import private snapshot<input type=\"file\" id=\"snapshot-file\" accept=\".json,application/json\"></label></section>\n<div id=\"status\" role=\"status\" aria-live=\"polite\"></div>\n<section class=\"filterbar\"><label>Section<select id=\"section\"><option value=\"\">Both sections</option><option value=\"32\">Section 32</option><option value=\"33\">Section 33</option></select></label><label>Topic<select id=\"topic\"><option value=\"\">All topics</option></select></label><label class=\"search\">Find a learner<input id=\"search\" placeholder=\"Name, admission or enrollment\"></label><label>Ranking basis<select id=\"metric\"><option value=\"overall\">Overall · missing counts as 0</option><option value=\"mastery\">Submitted work only</option><option value=\"completion\">Submission rate</option></select></label><button id=\"reset\">Reset</button></section>\n<section id=\"kpis\" class=\"kpis\"></section><section id=\"insight\" aria-live=\"polite\"></section>\n<section class=\"panel learner-panel\"><div class=\"panel-head\"><div><p class=\"eyebrow\">LEARNER EXPLORER</p><h2 id=\"table-title\">All learners</h2></div><span id=\"table-count\" class=\"muted\"></span></div><div class=\"table-scroll\"><table><thead><tr><th>Learner</th><th>Section</th><th>Overall /100</th><th>Submitted /100</th><th>Participation</th><th>Missing</th><th>Recorded late</th><th>Performance level</th></tr></thead><tbody id=\"learner-table\"></tbody></table></div><p class=\"footnote\">Click a learner to inspect topic evidence, marks and feedback. Overall includes every applicable activity equally, normalised to 100. Submitted average excludes missing work.</p></section>\n<details class=\"method\"><summary>How these insights are calculated</summary><p>Participation: Active ≥80% submitted; Intermediate active 50–79.9%; Low active &lt;50%. These are adjustable teaching indicators, not permanent student traits. Performance has three levels based on average submitted marks: High ≥80, Intermediate 50–79.9, Low below 50. Students without graded submissions remain unclassified and display a dash.</p><p>Topic rankings use whole-activity scores mapped to a single topic or mixed-topic group. A multi-topic assignment is never presented as a precise score for each individual topic. Missing records count as zero for overall performance. A recorded zero is still submitted when the backend status says Submitted.</p><p>Performance levels describe current submitted work, not learning speed or fixed ability. Historic submission timing with no explicit evidence is Unknown.</p></details>\n<footer>SOFT COMPUTING · FACULTY ANALYTICS <span id=\"snapshot-date\"></span></footer></main>\n<dialog id=\"learner-dialog\"><button id=\"close-dialog\" class=\"close\" aria-label=\"Close learner details\">×</button><div id=\"learner-detail\"></div></dialog>\n<script src=\"https://vipulshahi-ai.github.io/student-grade-hub/teacher/analytics.js\"></script><script src=\"https://vipulshahi-ai.github.io/student-grade-hub/teacher/teacher.js\"></script></body></html>\n";
