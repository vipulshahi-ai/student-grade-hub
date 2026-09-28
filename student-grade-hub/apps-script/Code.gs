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
    standing: 'Current_Standing'
  }
});

function doGet(e) {
  const params = (e && e.parameter) || {};
  let payload;

  try {
    if (params.action === 'health') {
      payload = { ok: true, service: 'student-grade-hub', updatedAt: new Date().toISOString() };
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
  const activities = ledger
    .filter(row => String(row['Student Key']) === String(student['Student Key']))
    .map(row => ({
      id: String(row['Activity ID'] || ''),
      title: String(row['Activity Title'] || 'Untitled activity'),
      category: String(row.Category || 'Activity'),
      marks: number_(row.Marks),
      maxMarks: number_(row['Max Marks']),
      normalizedScore: round1_(number_(row['Normalized Score /100'])),
      status: String(row.Status) === 'Not submitted' ? 'Not submitted' : 'Submitted',
      comment: String(row['Student Visible Feedback'] || row['Teacher Comment'] || '').trim()
    }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const submitted = activities.filter(activity => activity.status === 'Submitted').length;
  return {
    name: String(student['Student Name']),
    section: String(student.Section),
    admissionNo: String(student['Admission No.']),
    enrollmentNo: String(student['Enrollment No. / PRN']),
    normalizedScore: round1_(number_(student['Normalized Score /100'])),
    submitted,
    notSubmitted: activities.length - submitted,
    activities
  };
}

/** Add a staff menu whenever the spreadsheet opens. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Grade Hub')
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
    const status = hasRecordedMark ? 'Submitted' : 'Not submitted';
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
      const submitted = row.Marks !== '' && row.Marks !== null;
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
