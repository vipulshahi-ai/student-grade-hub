/**
 * Student Grade Hub API and grade-sync automation.
 *
 * Bind this script to the Grade Hub spreadsheet, then deploy it as a Web App.
 * Run installGradeHubMenu() once after pasting the file, or reload the sheet.
 */

const GRADE_HUB = Object.freeze({
  spreadsheetId: '1_Cc24P3mTbEDuRW2nAatTfMbpUi21QxDgGOHh3r9RD4',
  sheets: {
    activities: 'Activities',
    ledger: 'Student_Activity',
    standing: 'Current_Standing',
    issueLog: 'Grade_Queries'
  }
});

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.action === 'teacher') {
    try { return teacherDashboard_(); }
    catch (error) { return HtmlService.createHtmlOutput('<p>' + String(error.message || 'Teacher dashboard unavailable.').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) + '</p>'); }
  }
  let payload;

  try {
    if (params.action === 'health') {
      payload = { ok: true, service: 'student-grade-hub', updatedAt: new Date().toISOString() };
    } else if (params.action === 'reportIssue') {
      payload = { ok: true, issue: reportGradeQuery_(params) };
    } else {
      const lookup = normaliseLookup_(params.id || '');
      if (!lookup) throw new Error('Enter an admission number or enrollment number.');
      payload = { ok: true, report: getStudentReport_(lookup) };
    }
  } catch (error) {
    payload = { ok: false, error: error.message || 'Unable to retrieve the report.' };
  }

  return jsonResponse_(payload, params.callback);
}

function getStudentReport_(lookup) {
  const ss = SpreadsheetApp.openById(GRADE_HUB.spreadsheetId);
  const standing = records_(ss.getSheetByName(GRADE_HUB.sheets.standing));
  const student = standing.find(row =>
    normaliseLookup_(row['Admission No.']) === lookup ||
    normaliseLookup_(row['Enrollment No. / PRN']) === lookup
  );

  if (!student) throw new Error('No student report was found for that number.');

  const ledger = records_(ss.getSheetByName(GRADE_HUB.sheets.ledger));
  const section = String(student.Section || '').match(/\d+/)?.[0] || '';
  const gradesByActivity = new Map(
    ledger
      .filter(row => String(row['Student Key']) === String(student['Student Key']))
      .map(row => [String(row['Activity ID']), row])
  );

  // Build the report from the activity catalogue, not only ledger rows. A
  // missing ledger row deliberately represents a student who did not submit.
  const activities = records_(ss.getSheetByName(GRADE_HUB.sheets.activities))
    .filter(activity => String(activity['Student Portal Visible']).toLowerCase() === 'yes')
    .filter(activity => isEligibleForSection_(activity['Eligible Section'], section))
    .map(activity => {
      const row = gradesByActivity.get(String(activity['Activity ID'])) || {};
      const submitted = String(row.Status) === 'Submitted';
      return {
        id: String(activity['Activity ID'] || ''),
        title: String(activity['Activity Title'] || 'Untitled activity'),
        category: String(activity.Category || 'Activity'),
        marks: submitted ? number_(row.Marks) : 0,
        maxMarks: number_(row['Max Marks'] || activity['Max Marks']),
        normalizedScore: submitted ? round1_(number_(row['Normalized Score /100'])) : 0,
        status: submitted ? 'Submitted' : 'Not submitted',
        timing: submissionTiming_(row, submitted),
        comment: String(row['Student Visible Feedback'] || row['Teacher Comment'] || '').trim()
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const submitted = activities.filter(activity => activity.status === 'Submitted').length;
  const equalWeightScore = activities.length
    ? round1_(activities.reduce((total, activity) => total + activity.normalizedScore, 0) / activities.length)
    : 0;
  return {
    name: String(student['Student Name']),
    section: String(student.Section),
    admissionNo: String(student['Admission No.']),
    enrollmentNo: String(student['Enrollment No. / PRN']),
    // Calculate from the same records returned to the UI. This keeps the
    // overall value current even before a separate standing summary refresh.
    normalizedScore: equalWeightScore,
    submitted,
    notSubmitted: activities.length - submitted,
    activities,
    midSemFeedback: midSemFeedback_(activities)
  };
}

/**
 * Accept a student grade query from the public portal. Only activities that
 * are missing or have a recorded score of zero may be selected.
 */
function reportGradeQuery_(params) {
  const lookup = normaliseLookup_(params.id || '');
  if (!lookup) throw new Error('Enter an admission number or enrollment number.');

  const requestedIds = [...new Set(String(params.activities || '')
    .split(',')
    .map(value => String(value).trim())
    .filter(Boolean))];
  if (!requestedIds.length) throw new Error('Select at least one activity.');
  if (requestedIds.length > 12) throw new Error('Select no more than 12 activities at once.');

  const report = getStudentReport_(lookup);
  const eligible = report.activities.filter(activity =>
    requestedIds.includes(activity.id) &&
    (activity.status === 'Not submitted' || number_(activity.marks) === 0)
  );
  if (eligible.length !== requestedIds.length) {
    throw new Error('One or more selected activities are not eligible for a grade query.');
  }

  const ss = SpreadsheetApp.openById(GRADE_HUB.spreadsheetId);
  const sheet = getOrCreateIssueSheet_(ss);
  const note = String(params.note || '').trim().slice(0, 1000);
  sheet.appendRow([
    new Date(),
    report.admissionNo,
    report.enrollmentNo,
    report.name,
    report.section,
    eligible.map(activity => activity.id).join(', '),
    eligible.map(activity => activity.title).join(' | '),
    note,
    'Open',
    ''
  ]);
  return { recorded: true, activities: eligible.length };
}

function getOrCreateIssueSheet_(ss) {
  let sheet = ss.getSheetByName(GRADE_HUB.sheets.issueLog);
  if (sheet) return sheet;
  sheet = ss.insertSheet(GRADE_HUB.sheets.issueLog);
  sheet.getRange(1, 1, 1, 10).setValues([[
    'Submitted At', 'Admission No.', 'Enrollment No. / PRN', 'Student Name',
    'Section', 'Activity IDs', 'Activities', 'Student Note', 'Status', 'Instructor Notes'
  ]]);
  sheet.setFrozenRows(1);
  return sheet;
}

function midSemFeedback_(activities) {
  const submitted = activities.filter(activity => activity.status === 'Submitted');
  const missing = activities.filter(activity => activity.status === 'Not submitted');
  const strongest = submitted
    .slice()
    .sort((a, b) => b.normalizedScore - a.normalizedScore || a.id.localeCompare(b.id))
    .slice(0, 2);
  const lowest = submitted
    .slice()
    .sort((a, b) => a.normalizedScore - b.normalizedScore || a.id.localeCompare(b.id))
    .slice(0, 2);

  return {
    doingWell: strongest.length
      ? `Strongest work: ${strongest.map(activity => `${activity.id} (${formatScore_(activity.normalizedScore)})`).join(', ')}.`
      : 'No graded submissions are available yet.',
    improve: missing.length
      ? `Review missed work: ${missing.slice(0, 3).map(activity => activity.title).join('; ')}${missing.length > 3 ? ` and ${missing.length - 3} more` : ''}. Midterm submissions are closed. Raise a grade query if you already submitted.`
      : lowest.length
        ? `Focus next on: ${lowest.map(activity => `${activity.id} (${formatScore_(activity.normalizedScore)})`).join(', ')}.`
        : 'Keep your submission record consistent.'
  };
}

function submissionTiming_(row, submitted) {
  if (!submitted) return 'Not submitted';
  const explicit = String(row['Submission Timing'] || '').trim().toLowerCase();
  if (explicit === 'late') return 'Late';
  if (explicit === 'on time' || explicit === 'on-time') return 'On time';
  if (explicit === 'unknown') return 'Unknown';
  const evidence = [
    row['Teacher Comment'],
    row['Student Visible Feedback'],
    row['Source Detail']
  ].map(value => String(value || '').toLowerCase()).join(' ');
  return /\blate\b/.test(evidence)
    ? 'Late'
    : 'On time';
}

function formatScore_(value) {
  return Number(number_(value)).toFixed(1);
}

/** Add a staff menu whenever the spreadsheet opens. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Grade Hub')
    .addItem('Open faculty analytics', 'showTeacherDashboard')
    .addItem('Sync current activity tab', 'syncCurrentActivity')
    .addItem('Sync all activity tabs', 'syncAllActivities')
    .addToUi();
}

/** Sync the active activity sheet into Student_Activity. */
function syncCurrentActivity() {
  const activeName = SpreadsheetApp.getActiveSheet().getName();
  const match = activeName.match(/^(A\d{2})\b/);
  if (!match) throw new Error('Open an activity tab whose name starts with an activity ID, for example A16 Quiz 6.');
  syncActivity_(match[1]);
  SpreadsheetApp.getActive().toast('Activity synced to Student_Activity.', 'Grade Hub');
}

/** Sync every tab named like A01 ..., A02 ..., etc. */
function syncAllActivities() {
  const ss = SpreadsheetApp.getActive();
  const ids = ss.getSheets()
    .map(sheet => sheet.getName().match(/^(A\d{2})\b/))
    .filter(Boolean)
    .map(match => match[1]);
  ids.forEach(syncActivity_);
  ss.toast(`${ids.length} activity tabs synced.`, 'Grade Hub');
}

/**
 * Sync one activity tab. A row with no mark is Not submitted; every recorded
 * row is Submitted. This deliberately has no review/pending state.
 */
function syncActivity_(activityId) {
  const ss = SpreadsheetApp.openById(GRADE_HUB.spreadsheetId);
  const activitySheet = ss.getSheets().find(sheet => sheet.getName().indexOf(`${activityId} `) === 0);
  if (!activitySheet) throw new Error(`Could not find the tab for ${activityId}.`);

  const sourceRows = records_(activitySheet);
  const ledgerSheet = ss.getSheetByName(GRADE_HUB.sheets.ledger);
  const activity = activityDefinition_(ss, activityId, activitySheet.getName());
  ensureLedgerRows_(ledgerSheet, sourceRows, activity);
  const ledgerValues = ledgerSheet.getDataRange().getValues();
  const headers = ledgerValues[0].map(String);
  const column = headerIndex_(headers);
  const byKey = new Map();
  for (let r = 1; r < ledgerValues.length; r++) {
    if (String(ledgerValues[r][column['Activity ID']]) === activityId) {
      byKey.set(String(ledgerValues[r][column['Student Key']]), r + 1);
    }
  }

  sourceRows.forEach(source => {
    const studentKey = String(source['Student Key'] || '');
    const targetRow = byKey.get(studentKey);
    if (!studentKey || !targetRow) return;
    const marks = source.Marks === '' || source.Marks === null ? 0 : number_(source.Marks);
    const hasRecordedMark = source.Marks !== '' && source.Marks !== null;
    const status = source.Status === 'Not submitted' ? 'Not submitted'
      : source.Status === 'Submitted' || hasRecordedMark ? 'Submitted' : 'Not submitted';
    const feedback = String(source['Student Visible Feedback'] || source['Teacher Comment'] || '').trim();
    const sourceDetail = String(source['Source Detail'] || '').trim();
    const updated = new Date();

    ledgerSheet.getRange(targetRow, column.Marks + 1, 1, 8).setValues([[
      marks,
      number_(source['Max Marks']),
      status,
      String(source['Teacher Comment'] || '').trim(),
      feedback,
      sourceDetail,
      updated,
      `=IFERROR(F${targetRow}/G${targetRow}*100,0)`
    ]]);
  });
}

/**
 * Seeds Student_Activity for a newly added activity tab. This is why weekly
 * activities can be added without changing the student-report UI or formulas.
 */
function ensureLedgerRows_(ledgerSheet, sourceRows, activity) {
  const existing = records_(ledgerSheet);
  const keys = new Set(existing
    .filter(row => String(row['Activity ID']) === activity.id)
    .map(row => String(row['Student Key'])));
  const firstNewRow = ledgerSheet.getLastRow() + 1;
  const additions = sourceRows
    .filter(row => row['Student Key'] && !keys.has(String(row['Student Key'])))
    .map((row, index) => {
      const targetRow = firstNewRow + index;
      const marks = row.Marks === '' || row.Marks === null ? 0 : number_(row.Marks);
      const submitted = row.Status === 'Not submitted' ? false
        : row.Status === 'Submitted' || (row.Marks !== '' && row.Marks !== null);
      return [
        String(row['Student Key']),
        String(row.Section || ''),
        activity.id,
        activity.title,
        activity.category,
        marks,
        number_(row['Max Marks'] || activity.maxMarks),
        submitted ? 'Submitted' : 'Not submitted',
        String(row['Teacher Comment'] || '').trim(),
        String(row['Student Visible Feedback'] || row['Teacher Comment'] || '').trim(),
        String(row['Source Detail'] || '').trim(),
        new Date(),
        `=IFERROR(F${targetRow}/G${targetRow}*100,0)`
      ];
    });
  if (additions.length) ledgerSheet.getRange(firstNewRow, 1, additions.length, 13).setValues(additions);
}

function activityDefinition_(ss, activityId, sheetName) {
  const row = records_(ss.getSheetByName(GRADE_HUB.sheets.activities))
    .find(activity => String(activity['Activity ID']) === activityId) || {};
  return {
    id: activityId,
    title: String(row['Activity Title'] || sheetName.replace(/^A\d{2}\s*/, '')),
    category: String(row.Category || 'Activity'),
    maxMarks: number_(row['Max Marks'])
  };
}

function records_(sheet) {
  if (!sheet) throw new Error('A required backend sheet is missing.');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(value => value !== '')).map(row => {
    const record = {};
    headers.forEach((header, index) => { record[header] = row[index]; });
    return record;
  });
}

function headerIndex_(headers) {
  return headers.reduce((map, header, index) => { map[header] = index; return map; }, {});
}

function normaliseLookup_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function number_(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isEligibleForSection_(eligibleSection, section) {
  const value = String(eligibleSection || '').trim().toLowerCase();
  return value === 'both' || value === String(section).toLowerCase();
}

function round1_(value) {
  return Math.round(value * 10) / 10;
}

function jsonResponse_(payload, callback) {
  const json = JSON.stringify(payload);
  const safeCallback = /^[A-Za-z_$][\w$]*$/.test(String(callback || '')) ? callback : '';
  return ContentService
    .createTextOutput(safeCallback ? `${safeCallback}(${json});` : json)
    .setMimeType(safeCallback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
