/* Shared pure analytics. No roster or grades are bundled in this public file. */
(function(root) {
  'use strict';
  const round = x => Math.round(x * 10) / 10;
  const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
  const records = matrix => Array.isArray(matrix) && Array.isArray(matrix[0])
    ? matrix.slice(1).filter(r=>r[0]).map(r=>Object.fromEntries(matrix[0].map((h,i)=>[h,r[i] ?? '']))) : (matrix || []);
  const defaultTopics = {
    A01:'Neural computing foundations', A02:'Neural computing foundations', A03:'Neural computing foundations',
    A04:'Artificial neurons & Hebbian learning', A05:'Perceptron & ADALINE',
    A06:'Perceptron & ADALINE', A07:'Perceptron & ADALINE', A08:'ADALINE',
    A09:'Backpropagation', A10:'Backpropagation', A11:'Neural network coding — mixed', A12:'ADALINE',
    A13:'Neural computing foundations', A14:'Neural computing foundations', A15:'Neural learning — mixed review',
    A16:'Neural networks & hybrid systems', A17:'Neural networks & hybrid systems',
    A18:'Fuzzy sets & relations', A19:'Fuzzy sets & relations', A20:'Neural networks — cumulative',
    A21:'Fuzzy sets & relations', A22:'Neural networks, fuzzy sets & hybrid systems', A23:'Neural networks, fuzzy sets & hybrid systems',
    A24:'Soft computing — cumulative review', A25:'Neural networks — cumulative', A26:'Fuzzy logic — cumulative'
  };
  const performanceLevel = average => average === null ? null : average >= 80 ? 'High' : average >= 50 ? 'Intermediate' : 'Low';
  function normalize(raw) {
    const students = records(raw.students).map(s=>({key:String(s['Student Key'] || s.key),name:String(s['Student Name'] || s.name),section:String(s.Section || s.section).replace(/\D/g,''),admission:String(s['Admission No.'] || s.admission || ''),enrollment:String(s['Enrollment No. / PRN'] || s.enrollment || '')}));
    const topicRows = records(raw.topics || []);
    const topicById = Object.fromEntries(topicRows.map(r=>[String(r['Activity ID']),r.Topic]));
    const activities = records(raw.activities).filter(a=>String(a['Student Portal Visible'] ?? 'Yes').toLowerCase()==='yes').map(a=>({id:String(a['Activity ID'] || a.id),title:a['Activity Title'] || a.title,category:a.Category || a.category,max:Number(a['Max Marks'] || a.max || 0),section:String(a['Eligible Section'] || a.section || 'Both'),topic:topicById[a['Activity ID']] || defaultTopics[a['Activity ID']] || 'Unmapped topic',date:a['Assessment Date'] || a.date || null})).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
    const issues=[];const ledger=new Map();
    records(raw.ledger).forEach(r=>{const key=String(r['Student Key'])+'|'+String(r['Activity ID']);if(ledger.has(key))issues.push({type:'Duplicate ledger record',key});ledger.set(key,r);});
    const learnerRows = students.map(s=>{
      const rows=activities.filter(a=>a.section.toLowerCase()==='both'||a.section===s.section).map(a=>{
        const r=ledger.get(s.key+'|'+a.id)||{};const submitted=String(r.Status)==='Submitted';
        const maximum=Number(r['Max Marks'] || a.max); const marks=Number(r.Marks || 0);
        if(submitted&&(!Number.isFinite(marks)||marks<0||marks>maximum||maximum<=0))issues.push({type:'Invalid marks',key:s.key+'|'+a.id});
        const score=submitted&&maximum>0 ? Math.max(0,Math.min(100,marks/maximum*100)):0;
        const explicit=String(r['Submission Timing'] || '').toLowerCase();
        const evidence=[r['Teacher Comment'],r['Student Visible Feedback'],r['Source Detail']].join(' ');
        const timing=!submitted?'Missing':explicit==='late'||(/\blate\b/i.test(evidence)&&explicit!=='on time')?'Late':explicit==='on time'||explicit==='on-time'?'On time':'Unknown';
        return {...a,marks,max:maximum,score:round(score),submitted,timing,comment:String(r['Student Visible Feedback'] || r['Teacher Comment'] || '')};
      });
      const submitted=rows.filter(r=>r.submitted);const completion=rows.length?100*submitted.length/rows.length:0;
      const mastery=mean(submitted.map(r=>r.score));
      const overall=mean(rows.map(r=>r.score));
      const topics=[...new Set(rows.map(r=>r.topic))].map(topic=>{const tr=rows.filter(r=>r.topic===topic), sr=tr.filter(r=>r.submitted);return {topic,score:round(mean(tr.map(r=>r.score))||0),mastery:mean(sr.map(r=>r.score)),submitted:sr.length,total:tr.length};});
      // Speed needs measured learning intervals or comparable repeated attempts.
      // Grades, submission punctuality and activity ID order do not establish it.
      const engagement=completion>=80?'Active':completion>=50?'Intermediate active':'Low active';
      const level=performanceLevel(mastery);
      const quiz=mean(submitted.filter(r=>r.category==='Quiz').map(r=>r.score));
      const lab=mean(submitted.filter(r=>r.category!=='Quiz').map(r=>r.score));
      return {...s,rows,topics,submitted:submitted.length,missing:rows.length-submitted.length,zero:submitted.filter(r=>r.score===0).length,late:submitted.filter(r=>r.timing==='Late').length,timingKnown:submitted.filter(r=>r.timing==='Late'||r.timing==='On time').length,completion:round(completion),overall:round(overall||0),mastery:mastery===null?null:round(mastery),engagement,performanceLevel:level,quiz:quiz===null?null:round(quiz),lab:lab===null?null:round(lab)};
    });
    return {students:learnerRows,activities,issues,generatedAt:raw.generatedAt||raw.snapshotAt||null,audit:raw.audit||{},queries:records(raw.queries||[]),defaultTopics};
  }
  function select(model, filters={}) {
    return model.students.filter(s=>!filters.section||s.section===filters.section).map(s=>{
      if(!filters.topic)return s;const rows=s.rows.filter(r=>r.topic===filters.topic);const sub=rows.filter(r=>r.submitted);const completion=rows.length?round(sub.length/rows.length*100):0;const mastery=sub.length?round(mean(sub.map(r=>r.score))):null;return {...s,rows,overall:round(mean(rows.map(r=>r.score))||0),mastery,completion,submitted:sub.length,missing:rows.length-sub.length,zero:sub.filter(r=>r.score===0).length,late:sub.filter(r=>r.timing==='Late').length,engagement:completion>=80?'Active':completion>=50?'Intermediate active':'Low active',performanceLevel:performanceLevel(mastery),quiz:mean(sub.filter(r=>r.category==='Quiz').map(r=>r.score)),lab:mean(sub.filter(r=>r.category!=='Quiz').map(r=>r.score))};
    }).filter(s=>!filters.query||[s.name,s.admission,s.enrollment].some(v=>v.toLowerCase().includes(filters.query.toLowerCase())));
  }
  function rank(rows,metric='overall',limit=10) {
    const sorted=rows.slice().sort((a,b)=>(b[metric]??-1)-(a[metric]??-1)||a.name.localeCompare(b.name));
    let previous=null, currentRank=0;
    const ranked=sorted.map((s,i)=>{if(i===0||s[metric]!==previous)currentRank=i+1;previous=s[metric];return {...s,rank:currentRank};});
    return ranked.filter(s=>s.rank<=limit);
  }
  const api={normalize,select,rank,mean,round,performanceLevel,defaultTopics};root.GradeAnalytics=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

/* Server-side projection. Only the requested report and anonymous comparisons leave the server. */
(function(root){
  'use strict';
  function report(raw, lookup, aliasFor) {
    const A=root.GradeAnalytics, model=A.normalize(raw);
    const key=String(lookup||'').replace(/\s/g,'').toLowerCase();
    if(!/^[a-z0-9.-]{5,40}$/.test(key))throw new Error('Enter a valid admission or enrollment number.');
    const me=model.students.find(s=>[s.admission,s.enrollment].some(v=>v.replace(/\s/g,'').toLowerCase()===key));
    if(!me)throw new Error('No student report was found for that number.');
    const privateFeedback=text=>{
      let value=String(text||'');
      for(const peer of model.students){
        if(peer.key===me.key)continue;
        for(const id of [peer.admission,peer.enrollment].filter(Boolean))value=value.split(id).join('[another student ID]');
        if(peer.name.trim().split(/\s+/).length>=2){
          const escaped=peer.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
          value=value.replace(new RegExp('\\b'+escaped+'\\b','gi'),'[another student]');
        }
      }
      return value;
    };
    const cohort=model.students.filter(s=>s.rows.length>0);
    const section=cohort.filter(s=>s.section===me.section);
    const standing=rows=>{
      const ranked=A.rank(rows,'overall',Infinity), own=ranked.find(s=>s.key===me.key);
      const threshold=ranked.filter(s=>s.rank<=10).at(-1)?.overall;
      return {rank:own?.rank??null,total:rows.length,average:A.round(A.mean(rows.map(s=>s.overall))||0),gapToTop10:threshold===undefined?null:A.round(Math.max(0,threshold-me.overall))};
    };
    const board=rows=>A.rank(rows).map(s=>({rank:s.rank,alias:aliasFor(s.key),score:s.overall,isYou:s.key===me.key}));
    const topics=me.topics.map(t=>{
      const rows=A.select(model,{topic:t.topic,section:me.section}).filter(s=>s.rows.length);
      return {...t,rank:A.rank(rows,'overall',Infinity).find(s=>s.key===me.key)?.rank??null,totalLearners:rows.length,
        sectionAverage:A.round(A.mean(rows.map(s=>s.overall))||0),limitedEvidence:t.total<2,
        leaderboard:board(rows)};
    });
    const strongest=me.topics.filter(t=>t.submitted).slice().sort((a,b)=>b.mastery-a.mastery)[0];
    const weakest=me.topics.filter(t=>t.submitted).slice().sort((a,b)=>a.mastery-b.mastery)[0];
    const doingWell=strongest?`Your strongest submitted topic is ${strongest.topic} (${A.round(strongest.mastery)}/100 across ${strongest.submitted} submitted activities).`:'No submitted evidence is available yet.';
    const steps=[];
    if(me.missing)steps.push(`${me.missing} activities have no submission recorded. Midterm submissions are closed; raise a grade query if you already submitted them.`);
    if(weakest&&weakest.mastery<80)steps.push(`Practise ${weakest.topic} using the feedback on your submitted work (${A.round(weakest.mastery)}/100).`);
    if(me.late)steps.push(`${me.late} submissions are recorded late. Plan earlier completion for future activities.`);
    if(me.quiz!==null&&me.lab!==null&&Math.abs(me.quiz-me.lab)>=20)steps.push(me.quiz>me.lab?'Your quiz scores exceed practical scores; focus on guided coding practice.':'Your practical scores exceed quiz scores; practise explaining the underlying concepts.');
    if(!steps.length)steps.push('Keep your submission record consistent and review the feedback on your lower-scoring work.');
    return {
      name:me.name,section:'Section '+me.section,admissionNo:me.admission,enrollmentNo:me.enrollment,
      normalizedScore:me.overall,submitted:me.submitted,notSubmitted:me.missing,
      activities:me.rows.map(r=>({id:r.id,title:r.title,category:r.category,topic:r.topic,marks:r.marks,maxMarks:r.max,normalizedScore:r.score,status:r.submitted?'Submitted':'Not submitted',timing:r.submitted?r.timing:'Not submitted',comment:privateFeedback(r.comment)})),
      midSemFeedback:{doingWell,improve:steps.join(' ')},
      insights:{section:standing(section),overall:standing(cohort),alias:aliasFor(me.key),
        mastery:me.mastery,participation:me.completion,performanceLevel:me.performanceLevel,engagement:me.engagement,
        timing:{onTime:me.rows.filter(r=>r.timing==='On time').length,late:me.late,unknown:me.submitted-me.timingKnown},
        topics,leaderboards:{section:board(section),overall:board(cohort)},generatedAt:raw.generatedAt}
    };
  }
  root.StudentInsights={report};
  if(typeof module!=='undefined')module.exports=root.StudentInsights;
})(typeof window!=='undefined'?window:globalThis);

/* Separate, least-privilege Apps Script project for temporary faculty access. */
const LEADERSHIP_SHEET_ID = '1_Cc24P3mTbEDuRW2nAatTfMbpUi21QxDgGOHh3r9RD4';
const LEADERSHIP_OWNER = 'bipul.kumar1@galgotiasuniversity.edu.in';
const LEADERSHIP_SESSION_SECONDS = 1800;

/* Portal transport: credentials stay in the HTTPS request body, never a URL. */
function doPost(e) {
  let result;
  try {
    const body = String(e && e.postData && e.postData.contents || '');
    if (!body || body.length > 1024) throw new Error('Invalid request.');
    const request = JSON.parse(body);
    if (!request || typeof request !== 'object') throw new Error('Invalid request.');
    let data;
    switch (request.action) {
      case 'student': data = getPortalStudentReport_(request.id); break;
      case 'login': data = authenticateLeadership(request.code, request.token); break;
      case 'data': data = getLeadershipData(request.token); break;
      case 'lock': data = lockLeadershipSession(request.token); break;
      default: throw new Error('Unsupported request.');
    }
    result = {ok: true, data: data};
  } catch (error) {
    result = {ok: false, error: String(error.message || 'Could not complete the request.')};
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function getPortalStudentReport_(lookup) {
  const id = String(lookup || '').replace(/\s/g, '').toLowerCase();
  if (!/^[a-z0-9.-]{5,40}$/.test(id)) throw new Error('Enter a valid admission or enrollment number.');
  const p = PropertiesService.getScriptProperties();
  let salt = p.getProperty('STUDENT_ALIAS_SALT');
  if (!salt) {
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      salt = p.getProperty('STUDENT_ALIAS_SALT');
      if (!salt) { salt = Utilities.getUuid() + Utilities.getUuid(); p.setProperties({STUDENT_ALIAS_SALT:salt}); }
    } finally { lock.releaseLock(); }
  }
  const tables = leadershipTables_(['Students','Activities','Student_Activity','Teacher_Topics']);
  return StudentInsights.report({students:tables.Students,activities:tables.Activities,ledger:tables.Student_Activity,topics:tables.Teacher_Topics,generatedAt:new Date().toISOString()}, id,
    key => 'Learner-' + leadershipDigest_(salt + ':' + key).slice(0,10).toUpperCase());
}

function doGet(e) {
  if (String((e && e.parameter && e.parameter.view) || '') === 'setup') {
    try { requireLeadershipOwner_(); return HtmlService.createHtmlOutput(LEADERSHIP_SETUP_HTML_).setTitle('Faculty access settings'); }
    catch (_) { return HtmlService.createHtmlOutput('<p>Access settings are available to the faculty owner only.</p>'); }
  }
  return HtmlService.createHtmlOutput(LEADERSHIP_DASHBOARD_HTML_).setTitle('Soft Computing · Faculty Dashboard');
}

function requireLeadershipOwner_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (email !== LEADERSHIP_OWNER) throw new Error('Faculty owner access required.');
}

function leadershipDigest_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(n => ('0' + (n & 255).toString(16)).slice(-2)).join('');
}

function leadershipEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* The owner enters or generates the access code. No code is checked into source. */
function configureLeadershipAccess(code) {
  requireLeadershipOwner_();
  if (!/^(?:[0-9]{6}|[A-Za-z0-9_-]{32})$/.test(String(code || ''))) throw new Error('Enter a six-digit code or use Generate code.');
  const salt = Utilities.getUuid();
  const properties = PropertiesService.getScriptProperties();
  properties.setProperties({LEADERSHIP_SALT: salt, LEADERSHIP_HASH: leadershipDigest_(salt + ':' + code), LEADERSHIP_GENERATION: Utilities.getUuid()});
  CacheService.getScriptCache().remove('leadership_failures');
  return {ok: true};
}

function revokeLeadershipAccess() {
  requireLeadershipOwner_();
  const p = PropertiesService.getScriptProperties();
  ['LEADERSHIP_SALT','LEADERSHIP_HASH','LEADERSHIP_GENERATION'].forEach(key => p.deleteProperty(key));
  return {ok: true};
}

/* The token is generated by the visitor's browser with Web Crypto and lives only in memory. */
function authenticateLeadership(code, token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) throw new Error('Unable to start a secure session. Refresh and try again.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const cache = CacheService.getScriptCache();
    const failures = Number(cache.get('leadership_failures') || 0);
    if (failures >= 8) throw new Error('Too many attempts. Try again in a few minutes.');
    const p = PropertiesService.getScriptProperties();
    const salt = p.getProperty('LEADERSHIP_SALT');
    const hash = p.getProperty('LEADERSHIP_HASH');
    const generation = p.getProperty('LEADERSHIP_GENERATION');
    const input = String(code || '').slice(0, 128);
    if (!salt || !hash || !generation || !leadershipEqual_(hash, leadershipDigest_(salt + ':' + input))) {
      cache.put('leadership_failures', String(failures + 1), 300);
      throw new Error('The access code is invalid or has been revoked.');
    }
    cache.remove('leadership_failures');
    cache.put('leadership_session_' + leadershipDigest_(token), generation, LEADERSHIP_SESSION_SECONDS);
    return {ok: true};
  } finally { lock.releaseLock(); }
}

function requireLeadershipSession_(token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) throw new Error('Access session expired. Enter the code again.');
  const generation = PropertiesService.getScriptProperties().getProperty('LEADERSHIP_GENERATION');
  const saved = CacheService.getScriptCache().get('leadership_session_' + leadershipDigest_(token));
  if (!generation || !saved || !leadershipEqual_(generation, saved)) throw new Error('Access session expired or has been revoked. Enter the code again.');
}

function lockLeadershipSession(token) {
  if (/^[a-f0-9]{64}$/.test(String(token || ''))) CacheService.getScriptCache().remove('leadership_session_' + leadershipDigest_(token));
  return {ok: true};
}

/* Sheets API is used with an explicitly declared read-only scope. */
function leadershipSheetsGet_(path) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + LEADERSHIP_SHEET_ID + path;
  const response = UrlFetchApp.fetch(url, {
    method: 'get', headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    muteHttpExceptions: true, followRedirects: false
  });
  if (response.getResponseCode() !== 200) {
    let reason = '';
    try { reason = String(JSON.parse(response.getContentText()).error.message || '').slice(0, 800); } catch (_) {}
    throw new Error('Sheets API ' + response.getResponseCode() + ': ' + reason);
  }
  return JSON.parse(response.getContentText());
}

function leadershipTables_(names) {
  const result = {};
  for (let start = 0; start < names.length;) {
    let path = '/values:batchGet?valueRenderOption=FORMATTED_VALUE', end = start;
    while (end < names.length) {
      const quoted = "'" + names[end].replace(/'/g, "''") + "'!A:O";
      const part = '&ranges=' + encodeURIComponent(quoted);
      if (end > start && path.length + part.length > 1600) break;
      path += part; end++;
    }
    const values = leadershipSheetsGet_(path).valueRanges || [];
    if (values.length !== end - start) throw new Error('The grade sheet returned incomplete results.');
    for (let i = start; i < end; i++) result[names[i]] = values[i - start].values || [];
    start = end;
  }
  return result;
}

function getLeadershipData(token) {
  requireLeadershipSession_(token);
  const metadata = leadershipSheetsGet_('?fields=sheets(properties(title))');
  const available = new Set((metadata.sheets || []).map(sheet => sheet.properties && sheet.properties.title).filter(Boolean));
  const required = ['Students', 'Activities', 'Student_Activity'];
  if (required.some(name => !available.has(name))) throw new Error('A required grade sheet tab is missing.');
  const first = leadershipTables_(required.concat(['Teacher_Topics', 'Grade_Queries', 'Teacher_Audit'].filter(name => available.has(name))));
  const students = first.Students, activities = first.Activities, ledger = first.Student_Activity;
  const topics = first.Teacher_Topics || [], queries = first.Grade_Queries || [], audit = first.Teacher_Audit || [];
  const checks = audit.slice(1).filter(row => row[0]).map(row => ({label: row[0], result: row[1] || '', at: row[2] || ''}));
  const objects = values => values.length ? values.slice(1).filter(row => row[0]).map(row => Object.fromEntries(values[0].map((key, i) => [key, row[i] || '']))) : [];
  const byKey = new Map(objects(ledger).map(row => [row['Student Key'] + '|' + row['Activity ID'], row]));
  const activityRows = objects(activities);
  const sourceNames = [...new Set(activityRows.map(row => String(row['Grading Tab'] || '')).filter(name => available.has(name)))];
  const sources = leadershipTables_(sourceNames);
  let differences = 0;
  activityRows.forEach(activity => {
    const source = sources[String(activity['Grading Tab'])];
    if (!source) return;
    objects(source).forEach(row => {
      const record = byKey.get(row['Student Key'] + '|' + activity['Activity ID']);
      if (!record || Number(row.Marks) !== Number(record.Marks) || row.Status !== record.Status || String(row['Student Visible Feedback'] || '') !== String(record['Student Visible Feedback'] || '')) differences++;
    });
  });
  checks.unshift({label: 'Activity tabs → student ledger', result: differences + ' differences in marks, status or feedback', at: new Date().toISOString()});
  requireLeadershipSession_(token);
  return {students, activities, ledger, topics, queries, generatedAt: new Date().toISOString(), audit: {checks}};
}

/* Owner-only connection check for the Apps Script editor. */
function verifyFacultyConnection() {
  requireLeadershipOwner_();
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  const metadata = leadershipSheetsGet_('?fields=sheets(properties(title))');
  console.log('Read-only spreadsheet connection verified. Tabs: ' + (metadata.sheets || []).length);
  return {ok: true};
}

const LEADERSHIP_DASHBOARD_HTML_ = "<!doctype html>\r\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Soft Computing · Faculty Analytics</title><link rel=\"stylesheet\" href=\"https://vipulshahi-ai.github.io/student-grade-hub/teacher/teacher.css\"><base target=\"_blank\"></head>\r\n<body>\r\n<aside><a class=\"brand\" href=\"#\" target=\"_self\"><span class=\"brand-icon\">∑</span><span>SOFT COMPUTING<small>Faculty workspace</small></span></a><p class=\"nav-label\">ANALYSE</p><nav id=\"insight-nav\"><button data-view=\"overview\" class=\"selected\">◫ <span>Overview</span></button><button data-view=\"topics\">▥ <span>Topic intelligence</span></button><button data-view=\"top\">↗ <span>Top 10 learners</span></button><button data-view=\"engagement\">◉ <span>Participation bands</span></button><button data-view=\"support\">◎ <span>Support priorities</span></button><button data-view=\"gap\">⇄ <span>Quiz–lab gap</span></button><button data-view=\"performance\">◷ <span>Performance levels</span></button><button data-view=\"audit\">☷ <span>Data & grading audit</span></button><button data-view=\"mapping\">⌘ <span>Topic mapping</span></button></nav><div class=\"privacy\">TEACHER VIEW<br><span>Roster and grades are loaded privately. No class dataset is published with this page.</span></div></aside>\r\n<main><header><div><p class=\"eyebrow\">MIDTERM · SECTIONS 32 & 33</p><h1 id=\"page-title\">Learning, at a glance.</h1><p id=\"page-subtitle\">Explore participation, topic evidence and where support will help.</p></div><div class=\"actions\"><button id=\"refresh\" class=\"primary\">↻ Refresh from sheet</button><button id=\"export\">↓ Export view</button><button id=\"print\">Print</button></div></header>\r\n<section id=\"connection\" class=\"connection\"><div><strong id=\"connection-state\">Connect your teaching data</strong><p id=\"freshness\">Open the authenticated faculty dashboard for live Google Sheet data, or import a private Grade Hub JSON snapshot.</p></div><label class=\"file-button\">Import private snapshot<input type=\"file\" id=\"snapshot-file\" accept=\".json,application/json\"></label></section>\r\n<div id=\"status\" role=\"status\" aria-live=\"polite\"></div>\r\n<section class=\"filterbar\"><label>Section<select id=\"section\"><option value=\"\">Both sections</option><option value=\"32\">Section 32</option><option value=\"33\">Section 33</option></select></label><label>Topic<select id=\"topic\"><option value=\"\">All topics</option></select></label><label class=\"search\">Find a learner<input id=\"search\" placeholder=\"Name, admission or enrollment\"></label><label>Ranking basis<select id=\"metric\"><option value=\"overall\">Overall · missing counts as 0</option><option value=\"mastery\">Submitted work only</option><option value=\"completion\">Submission rate</option></select></label><button id=\"reset\">Reset</button></section>\r\n<section id=\"kpis\" class=\"kpis\"></section><section id=\"insight\" aria-live=\"polite\"></section>\r\n<section class=\"panel learner-panel\"><div class=\"panel-head\"><div><p class=\"eyebrow\">LEARNER EXPLORER</p><h2 id=\"table-title\">All learners</h2></div><span id=\"table-count\" class=\"muted\"></span></div><div class=\"table-scroll\"><table><thead><tr><th>Learner</th><th>Section</th><th>Overall /100</th><th>Submitted /100</th><th>Participation</th><th>Missing</th><th>Recorded late</th><th>Performance level</th></tr></thead><tbody id=\"learner-table\"></tbody></table></div><p class=\"footnote\">Click a learner to inspect topic evidence, marks and feedback. Overall includes every applicable activity equally, normalised to 100. Submitted average excludes missing work.</p></section>\r\n<details class=\"method\"><summary>How these insights are calculated</summary><p>Participation: Active ≥80% submitted; Intermediate active 50–79.9%; Low active &lt;50%. These are adjustable teaching indicators, not permanent student traits. Performance has three levels based on average submitted marks: High ≥80, Intermediate 50–79.9, Low below 50. Students without graded submissions remain unclassified and display a dash.</p><p>Topic rankings use whole-activity scores mapped to a single topic or mixed-topic group. A multi-topic assignment is never presented as a precise score for each individual topic. Missing records count as zero for overall performance. A recorded zero is still submitted when the backend status says Submitted.</p><p>Performance levels describe current submitted work, not learning speed or fixed ability. Historic submission timing with no explicit evidence is Unknown.</p></details>\r\n<footer>SOFT COMPUTING · FACULTY ANALYTICS <span id=\"snapshot-date\"></span></footer></main>\r\n<dialog id=\"learner-dialog\"><button id=\"close-dialog\" class=\"close\" aria-label=\"Close learner details\">×</button><div id=\"learner-detail\"></div></dialog>\r\n<script src=\"https://vipulshahi-ai.github.io/student-grade-hub/teacher/analytics.js?v=student-insights-1\"></script><script>'use strict';\r\nconst A = window.GradeAnalytics;\r\nconst $ = id => document.getElementById(id);\r\nconst esc = v => String(v ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\r\nconst score = n => n === null || n === undefined ? '—' : Number(n).toFixed(1);\r\nlet model=null,rawSnapshot=null,view='overview',band='All',visibleRows=[];\r\nconst labels={overview:['Learning, at a glance.','Explore participation, topic evidence and where support will help.'],topics:['Where understanding takes shape.','Compare topics using the activities that actually assessed them.'],top:['Recognise consistent performance.','Top 10 overall, within a section, or for the selected topic.'],engagement:['Participation is a starting point.','Separate consistent submission from gaps in participation.'],support:['Turn evidence into next steps.','Find the learners who need follow-up, practice or concept support.'],gap:['Connect theory with practice.','Compare submitted quiz work with coding and written assignments.'],performance:['Three performance levels.','Compare High, Intermediate and Low performance on submitted work.'],audit:['Trust the data behind the insight.','Inspect coverage, grading status and reconciliation evidence.'],mapping:['A transparent topic map.','See exactly which activity supports each topic comparison.']};\r\nfunction status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}\r\nfunction acceptData(raw){if(!raw||!raw.students||!raw.activities||!raw.ledger)throw new Error('This file needs Students, Activities and Student_Activity data.');rawSnapshot=raw;model=A.normalize(raw);const old=$('topic').value;$('topic').innerHTML='<option value=\"\">All topics</option>'+[...new Set(model.activities.map(a=>a.topic))].sort().map(t=>`<option>${esc(t)}</option>`).join('');if([...$('topic').options].some(o=>o.value===old))$('topic').value=old;$('connection-state').textContent='Teaching data connected';$('freshness').textContent=`${model.students.length} learners · ${model.activities.length} activity definitions · Refreshed ${formatDate(model.generatedAt)}`;$('snapshot-date').textContent='AS OF '+formatDate(model.generatedAt);render();}\r\nfunction formatDate(value){const d=new Date(value);return Number.isNaN(d.getTime())?'date unavailable':d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'});}\r\nfunction refresh(){if(!window.google?.script?.run){status('For live refresh, open the faculty Apps Script dashboard while signed into the teacher account. You can also import a private JSON snapshot here.');return;}status('Reading the latest Google Sheet…');$('refresh').disabled=true;google.script.run.withSuccessHandler(raw=>{try{acceptData(raw);status('Updated from the Google Sheet.');}catch(e){status(e.message,true);}$('refresh').disabled=false;}).withFailureHandler(error=>{status(error.message||'Could not read the teaching data.',true);$('refresh').disabled=false;}).getTeacherData();}\r\nfunction filtered(){return A.select(model,{section:$('section').value,topic:$('topic').value,query:$('search').value.trim()});}\r\nfunction kpi(label,value,detail,accent=false){return `<article class=\"kpi ${accent?'accent':''}\"><span class=\"label\">${label}</span><strong>${value}</strong><small>${detail}</small></article>`;}\r\nfunction panel(title,html,eyebrow='INSIGHT'){return `<article class=\"panel\"><div class=\"panel-head\"><div><p class=\"eyebrow\">${eyebrow}</p><h2>${title}</h2></div></div>${html}</article>`;}\r\nfunction bars(items){return items.map(x=>`<div class=\"bar-row\"><span>${esc(x.label)}</span><div class=\"track\"><div class=\"fill ${x.tone||(x.value<40?'red':x.value<65?'amber':'')}\" style=\"width:${Math.max(0,Math.min(100,x.value))}%\"></div></div><strong>${score(x.value)}${esc(x.unit||'')}</strong></div>`).join('');}\r\nfunction rankedCards(rows){return A.rank(rows,$('metric').value,10).map((s,i)=>`<div class=\"rank-card\" data-key=\"${esc(s.key)}\"><span class=\"rank-number\">${s.rank}</span><div><strong>${esc(s.name)}</strong><small>Section ${esc(s.section)} · ${esc(s.admission)}</small></div><span class=\"rank-score\">${score(s[$('metric').value])}${$('metric').value==='completion'?'%':''}</span></div>`).join('')||'<p class=\"empty\">No learners match these filters.</p>';}\r\nfunction render(){if(!model){$('insight').innerHTML=panel('Ready for your teaching data','<p class=\"empty\">Connect the private Google Sheet to begin.<br>Participation, topic results, rankings and learner drill-downs appear here.</p>');return;}\r\n  let rows=filtered();const submitted=rows.reduce((t,s)=>t+s.submitted,0),total=rows.reduce((t,s)=>t+s.rows.length,0);\r\n  $('page-title').textContent=labels[view][0];$('page-subtitle').textContent=labels[view][1];\r\n  $('kpis').innerHTML=kpi('LEARNERS IN VIEW',rows.length,`${new Set(rows.map(s=>s.section)).size} section(s)`)+kpi('EQUAL-WEIGHT AVERAGE',score(A.mean(rows.map(s=>s.overall))),'/100 · missing work included',true)+kpi('SUBMISSION RATE',score(total?submitted/total*100:0)+'%',`${submitted} of ${total} expected records`)+kpi('FOLLOW-UP PRIORITY',rows.filter(s=>s.completion<50||s.mastery!==null&&s.mastery<50).length,'Low participation or concept support');\r\n  let html='';\r\n  if(view==='overview'){\r\n    const topicItems=[...new Set(rows.flatMap(s=>s.rows.map(r=>r.topic)))].map(t=>({label:t,value:A.mean(rows.flatMap(s=>s.rows.filter(r=>r.topic===t).map(r=>r.score)))||0})).sort((a,b)=>b.value-a.value).slice(0,6);\r\n    const counts=['Active','Intermediate active','Low active'].map(x=>rows.filter(s=>s.engagement===x).length);\r\n    const sectionBars=bars(['32','33'].map(section=>({label:'Section '+section,value:A.mean(rows.filter(s=>s.section===section).map(s=>s.overall))||0})));\r\n    html=`<div class=\"two-col\">${panel('Topic performance',bars(topicItems)+'<p class=\"footnote\">Includes missing work as zero. Open Topic intelligence for submitted-only averages and evidence coverage.</p>','CONCEPTS IN VIEW')}${panel('Participation mix',`<div class=\"segmented\">${counts.map((n,i)=>`<span class=\"${['green','yellow','red'][i]}\" style=\"width:${rows.length?n/rows.length*100:0}%\"></span>`).join('')}</div><div class=\"segment-legend\">${counts.map((n,i)=>`<span><i class=\"dot ${['green','yellow','red'][i]}\"></i>${['Active','Intermediate','Low active'][i]} · ${n}</span>`).join('')}</div><p class=\"insight-note\">${rows.filter(s=>s.completion<50).length} learners have submitted fewer than half of their expected activities. Start with a submission check-in, then review submitted work for concept gaps.</p>`,'ENGAGEMENT')}</div><div class=\"two-col\">${panel('Section comparison',sectionBars)}${panel('Top performers',rankedCards(rows))}</div>`;\r\n  } else if(view==='topics'){\r\n    const names=[...new Set(rows.flatMap(s=>s.rows.map(r=>r.topic)))];\r\n    html='<div class=\"topic-grid\">'+names.map(topic=>{const rs=rows.flatMap(s=>s.rows.filter(r=>r.topic===topic)),submitted=rs.filter(r=>r.submitted),avg=A.mean(rs.map(r=>r.score))||0;return `<article class=\"topic-card\" data-topic=\"${esc(topic)}\" tabindex=\"0\" role=\"button\"><h3>${esc(topic)}</h3><strong>${score(avg)} <small>/100</small></strong><span class=\"metric-label\">All expected work</span><div class=\"track\"><div class=\"fill\" style=\"width:${avg}%\"></div></div><small>Submitted average ${score(A.mean(submitted.map(r=>r.score)))} · ${submitted.length}/${rs.length} records</small></article>`;}).join('')+'</div><p class=\"footnote\">Select a topic card to focus the learner explorer. Mixed-topic groups reflect bundled marks; they do not imply separate question-level scores.</p>';\r\n  } else if(view==='top'){\r\n    html=`<div class=\"insight-buttons\"><button data-section=\"\" class=\"${!$('section').value?'active':''}\">Top 10 overall</button><button data-section=\"32\" class=\"${$('section').value==='32'?'active':''}\">Top 10 · Section 32</button><button data-section=\"33\" class=\"${$('section').value==='33'?'active':''}\">Top 10 · Section 33</button></div>${panel($('topic').value?esc($('topic').value):'Overall top 10',rankedCards(rows))}`;rows=A.rank(rows,$('metric').value,10);\r\n  } else if(view==='engagement'||view==='support'){\r\n    const options=view==='engagement'?['All','Active','Intermediate active','Low active']:['All','Missing work','Concept support','Zero-mark work','Recorded late','High mastery, low participation'];\r\n    if(!options.includes(band))band='All';\r\n    html=panel(view==='engagement'?'Find a participation group':'Choose a follow-up list',`<div class=\"insight-buttons\">${options.map(o=>`<button data-band=\"${esc(o)}\" class=\"${band===o?'active':''}\">${esc(o)}</button>`).join('')}</div><p class=\"insight-note\">${view==='engagement'?'Participation uses submission coverage, independent of marks. These groups describe current activity, not ability.':'Support lists distinguish missing evidence from difficulties in submitted work. Use them to choose a practical next action.'}</p>`);\r\n    rows=rows.filter(s=>band==='All'||view==='engagement'&&s.engagement===band||band==='Missing work'&&s.missing>0||band==='Concept support'&&s.mastery!==null&&s.mastery<50||band==='Zero-mark work'&&s.zero>0||band==='Recorded late'&&s.late>0||band==='High mastery, low participation'&&s.mastery>=80&&s.completion<50);\r\n  } else if(view==='gap'){\r\n    rows=rows.filter(s=>s.quiz!==null&&s.lab!==null).sort((a,b)=>Math.abs(b.quiz-b.lab)-Math.abs(a.quiz-a.lab));\r\n    html=panel('Theory–practice differences',`<p class=\"insight-note\">A gap of 20 points or more is a follow-up signal. Quiz average uses submitted quizzes; practical average uses submitted coding, assignments and assessments. Different assessment difficulty can also explain a gap.</p><div class=\"table-scroll\"><table><thead><tr><th>Learner</th><th>Quiz /100</th><th>Practical /100</th><th>Difference</th><th>Suggested focus</th></tr></thead><tbody>${rows.slice(0,15).map(s=>`<tr data-key=\"${s.key}\"><td>${esc(s.name)}</td><td>${score(s.quiz)}</td><td>${score(s.lab)}</td><td>${score(s.quiz-s.lab)}</td><td>${Math.abs(s.quiz-s.lab)<20?'Balanced evidence':s.quiz>s.lab?'Guided coding practice':'Explain concepts and reasoning'}</td></tr>`).join('')}</tbody></table></div>`);\r\n  } else if(view==='performance'){\r\n    const classified=rows.filter(s=>s.performanceLevel!==null);\r\n    const options=['All','High','Intermediate','Low'];if(!options.includes(band))band='All';\r\n    html=panel('Performance levels',`<p class=\"insight-note\">High: 80–100. Intermediate: 50–79.9. Low: below 50. Scores are normalised to 100 and averaged across submitted work; submission coverage is shown separately.</p><div class=\"insight-buttons\">${options.map(o=>`<button data-band=\"${o}\" class=\"${band===o?'active':''}\">${o}</button>`).join('')}</div>${bars(['High','Intermediate','Low'].map(label=>({label:label+' · '+classified.filter(s=>s.performanceLevel===label).length+' learners',unit:'%',tone:label==='High'?'green':label==='Intermediate'?'amber':'red',value:classified.length?100*classified.filter(s=>s.performanceLevel===label).length/classified.length:0})))}<p class=\"footnote\">${classified.length} learners have graded evidence. ${rows.length-classified.length} without graded submissions remain unclassified; this is a data status, not another performance level.</p>`);\r\n    rows=rows.filter(s=>band==='All'||s.performanceLevel===band);\r\n  } else if(view==='audit'){\r\n    const checks=model.audit.checks||[];html=panel('Reconciliation status',`<ul id=\"audit-list\">${checks.map(c=>`<li><strong>${esc(c.label)}:</strong> ${esc(c.result)} <span class=\"muted\">${esc(c.at||'')}</span></li>`).join('')||'<li>No LMS audit record is attached to this snapshot. A live sheet read alone does not prove LMS agreement.</li>'}<li><strong>Ledger quality:</strong> ${model.issues.length} duplicate or invalid-mark issue(s).</li><li><strong>Timing coverage:</strong> ${model.students.reduce((t,s)=>t+s.timingKnown,0)} of ${model.students.reduce((t,s)=>t+s.submitted,0)} submitted records have explicit timing evidence.</li><li><strong>Open student grade queries:</strong> ${model.queries.filter(q=>q.Status==='Open').length}.</li></ul><p class=\"insight-note\">Grades and submission status are separate evidence. A blank LMS grade does not establish non-submission; submission records must be checked before changing status.</p>`);\r\n    html+=panel('Activity-level coverage','<div class=\"table-scroll\"><table><thead><tr><th>Topic</th><th>Assessment evidence</th><th>Expected</th><th>Submitted</th><th>Missing</th><th>Recorded zero</th></tr></thead><tbody>'+model.activities.map(a=>{const rs=model.students.flatMap(s=>s.rows.filter(r=>r.id===a.id));return `<tr><td class=\"wrap\">${esc(a.topic)}</td><td class=\"wrap\">${esc(a.title)}</td><td>${rs.length}</td><td>${rs.filter(r=>r.submitted).length}</td><td>${rs.filter(r=>!r.submitted).length}</td><td>${rs.filter(r=>r.submitted&&r.score===0).length}</td></tr>`;}).join('')+'</tbody></table></div>');\r\n  } else if(view==='mapping'){\r\n    html=panel('Activity → topic evidence','<p class=\"insight-note\">Topic names are the primary analytical labels. This mapping retains original activity titles for traceability. Broad or ambiguous assessments remain mixed-topic groups. Update the Teacher_Topics tab to refine a mapping; refresh here to apply it.</p><div class=\"table-scroll\"><table><thead><tr><th>Topic</th><th>Assessment evidence</th><th>Type</th><th>Section</th><th>Reference</th></tr></thead><tbody>'+model.activities.map(a=>`<tr><td class=\"wrap\">${esc(a.topic)}</td><td class=\"wrap\">${esc(a.title)}</td><td>${esc(a.category)}</td><td>${esc(a.section)}</td><td>${esc(a.id)}</td></tr>`).join('')+'</tbody></table></div>');\r\n  }\r\n  $('insight').innerHTML=html;visibleRows=rows;$('table-title').textContent=view==='top'?'Top 10 learners':(view==='support'||view==='performance')&&band!=='All'?band:'Learners in this view';$('table-count').textContent=rows.length+' learners';\r\n  $('learner-table').innerHTML=rows.slice().sort((a,b)=>view==='gap'?0:b[$('metric').value]-a[$('metric').value]).map(s=>`<tr data-key=\"${esc(s.key)}\" tabindex=\"0\"><td><span class=\"learner-name\">${esc(s.name)}</span><span class=\"learner-id\">${esc(s.admission)}</span></td><td>${esc(s.section)}</td><td><strong>${score(s.overall)}</strong></td><td>${score(s.mastery)}</td><td><span class=\"pill ${s.completion<50?'red':s.completion<80?'amber':''}\">${score(s.completion)}% · ${s.submitted}/${s.rows.length}</span></td><td>${s.missing}</td><td>${s.late}</td><td><span class=\"pill ${s.mastery===null?'gray':s.mastery<50?'red':s.mastery<80?'amber':''}\">${esc(s.performanceLevel||'—')}</span></td></tr>`).join('')||'<tr><td colspan=\"8\" class=\"empty\">No learners match this view.</td></tr>';\r\n  document.querySelectorAll('[data-key]').forEach(n=>{n.addEventListener('click',()=>showLearner(n.dataset.key));n.addEventListener('keydown',e=>{if(e.key==='Enter')showLearner(n.dataset.key);});});\r\n  document.querySelectorAll('[data-topic]').forEach(n=>{n.addEventListener('click',()=>{$('topic').value=n.dataset.topic;render();});n.addEventListener('keydown',e=>{if(e.key==='Enter'){$('topic').value=n.dataset.topic;render();}});});\r\n  document.querySelectorAll('[data-band]').forEach(n=>n.addEventListener('click',()=>{band=n.dataset.band;render();}));document.querySelectorAll('[data-section]').forEach(n=>n.addEventListener('click',()=>{$('section').value=n.dataset.section;render();}));\r\n}\r\nfunction showLearner(key){const s=model.students.find(s=>s.key===key);if(!s)return;const strongest=s.topics.filter(t=>t.submitted).slice().sort((a,b)=>b.mastery-a.mastery)[0];const weakest=s.topics.filter(t=>t.submitted).slice().sort((a,b)=>a.mastery-b.mastery)[0];$('learner-detail').innerHTML=`<p class=\"eyebrow\">LEARNER PROFILE</p><h2>${esc(s.name)}</h2><p class=\"detail-meta\">Section ${esc(s.section)} · ${esc(s.admission)} · ${esc(s.engagement)}</p><div class=\"kpis\">${kpi('OVERALL',score(s.overall),'/100 · equal activity weight',true)}${kpi('SUBMITTED AVERAGE',score(s.mastery),'/100 · submitted work only')}${kpi('SUBMITTED',s.submitted,s.missing+' missing')}${kpi('LATE EVIDENCE',s.late,(s.submitted-s.timingKnown)+' timing unknown')}</div><p class=\"insight-note\"><strong>Strongest evidence:</strong> ${strongest?esc(strongest.topic)+' ('+score(strongest.mastery)+'/100)':'No submitted evidence'}. <strong>Next focus:</strong> ${s.missing>0?'Review '+s.missing+' missing activities; ':''}${weakest?esc(weakest.topic):'Build an initial evidence record'}.</p><h3 style=\"margin:22px 0\">Topic performance</h3>${bars(s.topics.map(t=>({label:t.topic,value:t.score})))}<div class=\"table-scroll\"><table><thead><tr><th>Topic</th><th>Assessment</th><th>Marks</th><th>Normalised</th><th>Status / timing</th><th>Feedback</th></tr></thead><tbody>${s.rows.map(r=>`<tr><td class=\"wrap\">${esc(r.topic)}</td><td class=\"wrap\">${esc(r.title)}</td><td>${r.marks}/${r.max}</td><td>${score(r.score)}</td><td><span class=\"pill ${!r.submitted?'red':r.timing==='Late'?'amber':r.timing==='Unknown'?'gray':''}\">${r.submitted?r.timing:'Not submitted'}</span></td><td class=\"wrap\">${esc(r.comment||'—')}</td></tr>`).join('')}</tbody></table></div>`;$('learner-dialog').showModal();}\r\ndocument.querySelectorAll('[data-view]').forEach(n=>n.addEventListener('click',()=>{view=n.dataset.view;band='All';document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b===n));render();}));\r\n['section','topic','metric'].forEach(id=>$(id).addEventListener('change',render));$('search').addEventListener('input',render);$('reset').addEventListener('click',()=>{$('section').value='';$('topic').value='';$('search').value='';band='All';render();});$('refresh').addEventListener('click',refresh);$('print').addEventListener('click',()=>window.print());$('close-dialog').addEventListener('click',()=>$('learner-dialog').close());\r\n$('snapshot-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{acceptData(JSON.parse(await f.text()));status('Private snapshot loaded in this browser. It was not uploaded.');}catch(error){status(error.message,true);}});\r\n$('export').addEventListener('click',()=>{if(!model)return status('Connect your teaching data first.');const fields=['name','admission','section','overall','mastery','completion','submitted','missing','late','engagement','performanceLevel'];const csv=[fields.join(','),...visibleRows.map(s=>fields.map(f=>'\"'+String(s[f]??'').replace(/\"/g,'\"\"')+'\"').join(','))].join('\\r\\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='soft-computing-'+view+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});\r\nrender();\r\n</script><style>#leadership-gate{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:#f4f6f2;padding:20px}#leadership-gate[hidden]{display:none}#leadership-gate .gate-card{width:min(440px,100%);box-sizing:border-box;background:white;border:1px solid #dce5de;border-radius:16px;padding:32px;color:#173337;box-shadow:0 12px 45px #17333716}#leadership-gate h1{font-size:28px}#leadership-gate p{line-height:1.5;color:#647477}#leadership-gate label{display:block;margin:20px 0 8px;font-weight:700}#leadership-gate input{box-sizing:border-box;width:100%;border:1px solid #bdcfc7;border-radius:8px;padding:12px;font:inherit}#leadership-gate button{margin-top:14px;background:#087f75;color:white;border:0;border-radius:8px;padding:12px 16px;font-weight:700}#leadership-gate #gate-message{min-height:2em;color:#9c3b36}</style>\r\n<section id=\"leadership-gate\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Faculty Dashboard\"><form class=\"gate-card\" id=\"leadership-form\"><p class=\"eyebrow\">SOFT COMPUTING · FACULTY ANALYTICS</p><h1>Faculty Dashboard</h1><p>Enter the access code shared by the faculty owner.</p><label for=\"leadership-code\">Access code</label><input id=\"leadership-code\" type=\"password\" autocomplete=\"off\" required><button id=\"leadership-submit\" type=\"submit\">Open dashboard</button><p id=\"gate-message\" role=\"status\" aria-live=\"polite\"></p></form></section>\r\n<script>\r\n(()=>{'use strict';let token=null,sessionTimer=null;const gate=document.getElementById('leadership-gate'),form=document.getElementById('leadership-form'),input=document.getElementById('leadership-code'),msg=document.getElementById('gate-message'),submit=document.getElementById('leadership-submit');\r\nconst dashboardSections=[...document.body.children].filter(el=>el!==gate&&!['SCRIPT','STYLE'].includes(el.tagName));function setDashboardInert(value){dashboardSections.forEach(el=>{el.inert=value;});}setDashboardInert(true);\r\nconst currentRefresh=document.getElementById('refresh'),refreshButton=currentRefresh.cloneNode(true);currentRefresh.replaceWith(refreshButton);\r\nconst lockButton=document.createElement('button');lockButton.type='button';lockButton.textContent='Lock dashboard';lockButton.hidden=true;document.querySelector('.actions').append(lockButton);\r\nfunction showGate(message){token=null;input.hidden=false;input.required=true;document.querySelector('label[for=\"leadership-code\"]').hidden=false;submit.textContent='Open dashboard';clearTimeout(sessionTimer);lockButton.hidden=true;model=null;rawSnapshot=null;document.getElementById('learner-table').replaceChildren();document.getElementById('kpis').replaceChildren();document.getElementById('insight').replaceChildren();document.getElementById('learner-dialog').close();setDashboardInert(true);input.value='';gate.hidden=false;submit.disabled=false;msg.textContent=message||'';input.focus();}\r\nfunction loadData(opening=false){\r\n  if(!token)return showGate('Enter your access code to continue.');\r\n  const requestToken=token;refreshButton.disabled=true;\r\n  if(opening){submit.disabled=true;msg.textContent='Access code accepted. Loading dashboard…';}\r\n  status('Reading the latest Google Sheet…');\r\n  function failed(e){\r\n    if(token!==requestToken)return;\r\n    refreshButton.disabled=false;\r\n    const detail=e?.message||'The spreadsheet could not be loaded.';\r\n    if(/session.*(?:expired|revoked)|secure session/i.test(detail)){showGate(detail);return;}\r\n    if(opening){submit.disabled=false;submit.textContent='Retry loading data';msg.textContent='Access code accepted. Data could not load: '+detail;}\r\n    else status('Refresh failed. Previously loaded data is still shown. '+detail,true);\r\n  }\r\n  google.script.run.withSuccessHandler(raw=>{\r\n    if(token!==requestToken)return;\r\n    try{acceptData(raw);}catch(e){failed(e);return;}\r\n    status('Updated from the Google Sheet.');refreshButton.disabled=false;\r\n    if(opening){gate.hidden=true;setDashboardInert(false);lockButton.hidden=false;submit.disabled=false;submit.textContent='Open dashboard';msg.textContent='';}\r\n  }).withFailureHandler(failed).getLeadershipData(requestToken);\r\n}\r\nrefreshButton.addEventListener('click',()=>loadData(false));\r\nlockButton.addEventListener('click',()=>{const oldToken=token;showGate('Dashboard locked.');if(oldToken)google.script.run.lockLeadershipSession(oldToken);});\r\nform.addEventListener('submit',e=>{e.preventDefault();if(token){loadData(true);return;}if(!window.crypto?.getRandomValues){msg.textContent='A secure browser is required.';return;}const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);const candidate=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');const entered=input.value;input.value='';submit.disabled=true;msg.textContent='Checking access…';google.script.run.withSuccessHandler(()=>{token=candidate;input.hidden=true;input.required=false;document.querySelector('label[for=\"leadership-code\"]').hidden=true;sessionTimer=setTimeout(()=>showGate('Session expired. Enter your code again.'),1800000);loadData(true);}).withFailureHandler(error=>{submit.disabled=false;msg.textContent=error.message||'Could not check access.';input.focus();}).authenticateLeadership(entered,candidate);});\r\n})();\r\n</script>\r\n</body></html>\r\n";
const LEADERSHIP_SETUP_HTML_ = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><base target=\"_top\"><title>Faculty access settings</title><style>body{font:16px system-ui,sans-serif;background:#f4f6f2;color:#173337;margin:0}.card{max-width:620px;margin:8vh auto;padding:32px;border:1px solid #dce5de;border-radius:16px;background:white}h1{font-size:26px}p{line-height:1.55}label{display:block;font-weight:700;margin:22px 0 8px}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #bdcfc7;border-radius:8px;font:16px monospace}button{background:#087f75;color:white;border:0;border-radius:8px;padding:12px 15px;font-weight:700;cursor:pointer;margin:12px 8px 0 0}.secondary{background:#edf2ec;color:#173337}#msg{min-height:2em;color:#355f53}@media(max-width:680px){.card{margin:16px;padding:22px}}</style></head><body><main class=\"card\"><h1>Faculty access settings</h1><p>Enter a six-digit code or generate a longer code, then activate it. Share the code privately with authorized viewers. It remains valid until you revoke or replace it.</p><label for=\"code\">Access code</label><input id=\"code\" type=\"password\" autocomplete=\"new-password\" placeholder=\"Enter six digits or generate a code\"><button id=\"generate\" type=\"button\">Generate code</button><button id=\"activate\" type=\"button\" disabled>Activate code</button><button id=\"revoke\" type=\"button\" class=\"secondary\">Revoke access</button><p id=\"msg\" role=\"status\" aria-live=\"polite\"></p><p>Activating a new code or revoking access immediately invalidates existing access-code sessions.</p></main><script>\r\nconst code=document.getElementById('code'),message=document.getElementById('msg'),activate=document.getElementById('activate');\r\ncode.addEventListener('input',()=>{activate.disabled=!/^(?:[0-9]{6}|[A-Za-z0-9_-]{32})$/.test(code.value);message.textContent='';});\r\ndocument.getElementById('generate').addEventListener('click',()=>{if(!window.crypto?.getRandomValues){message.textContent='A secure browser is required to generate the code.';return;}const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';code.type='text';code.value=Array.from(bytes,n=>alphabet[n&63]).join('');activate.disabled=false;message.textContent='Copy this code before activating it. It cannot be recovered later.';});\r\nactivate.addEventListener('click',()=>{if(!code.value)return;activate.disabled=true;message.textContent='Activating…';google.script.run.withSuccessHandler(()=>{code.value='';code.type='password';message.textContent='Access is active. Keep the code private and share it with authorized viewers.';}).withFailureHandler(e=>{activate.disabled=false;message.textContent=e.message||'Could not activate access.';}).configureLeadershipAccess(code.value);});\r\ndocument.getElementById('revoke').addEventListener('click',()=>{message.textContent='Revoking…';google.script.run.withSuccessHandler(()=>{code.value='';activate.disabled=true;message.textContent='Faculty Dashboard and existing sessions are revoked.';}).withFailureHandler(e=>{message.textContent=e.message||'Could not revoke access.';}).revokeLeadershipAccess();});\r\n</script></body></html>\r\n";
