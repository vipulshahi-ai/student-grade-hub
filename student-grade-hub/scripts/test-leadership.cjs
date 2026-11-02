const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

const props = new Map(), cache = new Map();
let email = 'bipul.kumar1@galgotiasuniversity.edu.in', sheetReads = 0, revokeDuringRead = false;
const sheet = rows => ({getDataRange: () => ({getDisplayValues: () => rows})});
const sheets = {
  Students: sheet([['Student Key'], ['S32-001']]),
  Activities: sheet([['Activity ID', 'Grading Tab']]),
  Student_Activity: sheet([['Student Key', 'Activity ID'], ['S32-001', 'A01']]),
  Teacher_Topics: sheet([['Activity ID', 'Topic']]),
  Teacher_Audit: sheet([['Check', 'Result', 'Checked At']])
};
const context = {
  Session: {getActiveUser: () => ({getEmail: () => email})},
  PropertiesService: {getScriptProperties: () => ({getProperty: k => props.get(k) || null, setProperties: o => Object.entries(o).forEach(([k,v]) => props.set(k,v)), deleteProperty: k => props.delete(k)})},
  CacheService: {getScriptCache: () => ({get: k => cache.get(k) || null, put: (k,v) => cache.set(k,v), remove: k => cache.delete(k)})},
  LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() {}})},
  Utilities: {DigestAlgorithm: {SHA_256: 'sha256'}, Charset: {UTF_8: 'utf8'}, getUuid: () => crypto.randomUUID(), computeDigest: (_alg, s) => Array.from(crypto.createHash('sha256').update(s).digest())},
  ScriptApp: {getOAuthToken: () => 'test-oauth-token'},
  UrlFetchApp: {fetch: (url, options) => {
    sheetReads++;
    if (revokeDuringRead) props.delete('LEADERSHIP_GENERATION');
    const parsed = new URL(url);
    assert.equal(parsed.hostname, 'sheets.googleapis.com');
    assert.equal(options.followRedirects, false);
    assert.equal(options.headers.Authorization, 'Bearer test-oauth-token');
    const payload = parsed.pathname.endsWith('/values:batchGet')
      ? {valueRanges: parsed.searchParams.getAll('ranges').map(range => {
          const name = range.slice(1, range.lastIndexOf("'!A:O")).replace(/''/g, "'");
          return {values: sheets[name] ? sheets[name].getDataRange().getDisplayValues() : []};
        })}
      : {sheets: Object.keys(sheets).map(title => ({properties: {title}}))};
    return {getResponseCode: () => 200, getContentText: () => JSON.stringify(payload)};
  }},
  ContentService: {MimeType: {JSON: 'application/json'}, createTextOutput: text => ({text, setMimeType(){return this;}})},
  HtmlService: {createHtmlOutput: html => ({html, setTitle() {return this;}})},
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('student-grade-hub/apps-script/leadership/Bundle.gs', 'utf8'), context);
const code = '0123456789ABCDEFGHIJKLMNOPQRSTUV', token = 'a'.repeat(64), nextCode = 'abcdefghijklmnopqrstuv0123456789';
assert.throws(() => context.getLeadershipData(token), /expired/);
assert.equal(sheetReads, 0, 'Unauthenticated calls must not read the spreadsheet');
const post = request => JSON.parse(context.doPost({postData:{contents:JSON.stringify(request)}}).text);
assert.equal(post({action:'data',token}).ok,false);
assert.equal(post({action:'configureLeadershipAccess',code}).ok,false);
assert.equal(post({action:'revokeLeadershipAccess'}).ok,false);
assert.equal(sheetReads,0,'POST whitelist cannot expose grades or owner settings');
assert.equal(JSON.parse(context.doPost({postData:{contents:'{'}}).text).ok,false);
email = 'student@example.edu';
assert.throws(() => context.configureLeadershipAccess(code), /owner/);
assert.throws(() => context.revokeLeadershipAccess(), /owner/);
assert.match(context.doGet({parameter: {view: 'setup'}}).html, /owner only/);
email = 'bipul.kumar1@galgotiasuniversity.edu.in';
assert.throws(() => context.configureLeadershipAccess('short'), /six-digit/);
assert.throws(() => context.configureLeadershipAccess('12345'), /six-digit/);
assert.throws(() => context.configureLeadershipAccess('1234567'), /six-digit/);
assert.equal(context.configureLeadershipAccess('042857').ok, true);
assert.equal(context.authenticateLeadership('042857', token).ok, true);
assert.throws(() => context.authenticateLeadership('42857', token), /invalid/);
assert.equal(context.configureLeadershipAccess(code).ok, true);
assert(!Array.from(props.values()).includes(code), 'Only a salted code digest is stored');
assert.throws(() => context.authenticateLeadership('wrong', token), /invalid/);
assert.throws(() => context.authenticateLeadership(code, 'bad-token'), /secure session/);
assert.equal(context.authenticateLeadership(code, token).ok, true);
assert.equal(context.getLeadershipData(token).students.length, 2);
assert.equal(post({action:'login',code,token}).ok,true);
assert.equal(post({action:'data',token}).data.students.length,2);
assert.equal(post({action:'lock',token}).ok,true);
assert.equal(post({action:'data',token}).ok,false);
context.authenticateLeadership(code, token);
assert(!Array.from(cache.keys()).some(k => k.includes(token)), 'Session token is not stored as plaintext');
context.lockLeadershipSession(token);
assert.throws(() => context.getLeadershipData(token), /expired/);
context.authenticateLeadership(code, token);
context.configureLeadershipAccess(nextCode);
assert.throws(() => context.getLeadershipData(token), /revoked/);
context.authenticateLeadership(nextCode, token);
context.revokeLeadershipAccess();
assert.throws(() => context.getLeadershipData(token), /revoked/);
assert.throws(() => context.authenticateLeadership(nextCode, token), /invalid/);
context.configureLeadershipAccess(code);
context.authenticateLeadership(code, token);
revokeDuringRead = true;
assert.throws(() => context.getLeadershipData(token), /revoked/, 'Revocation during a read prevents a data response');
revokeDuringRead = false;
context.configureLeadershipAccess(code);
for (let i = 0; i < 8; i++) assert.throws(() => context.authenticateLeadership('incorrect', token), /invalid/);
assert.throws(() => context.authenticateLeadership(code, token), /Too many attempts/);
const source = fs.readFileSync('student-grade-hub/apps-script/leadership/Bundle.gs', 'utf8');
assert(!source.includes('localStorage'), 'Leadership tokens are not persisted in browser storage');
assert(source.includes('crypto.getRandomValues'), 'The browser generates a high-entropy code and session token');
console.log('Leadership access checks passed: owner-only setup, no unauthenticated sheet reads, wrong-code denial, hashed secrets, rotation and immediate revocation.');
