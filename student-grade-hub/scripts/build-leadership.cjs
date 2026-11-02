const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
let page = read('site', 'teacher', 'index.html');
let teacher = read('site', 'teacher', 'teacher.js');
const autoRefresh = 'render();if(window.google?.script?.run)refresh();';
if (!teacher.includes(autoRefresh)) throw new Error('The faculty auto-refresh hook changed; review the leadership gate before building.');
teacher = teacher.replace(autoRefresh, 'render();');
if (/<\/script/i.test(teacher)) throw new Error('The inline faculty script contains a closing script tag.');
const externalScript = /<script src="https:\/\/vipulshahi-ai\.github\.io\/student-grade-hub\/teacher\/teacher\.js[^\"]*"><\/script>/;
if (!externalScript.test(page)) throw new Error('Could not find the faculty script tag.');
page = page.replace(externalScript, '<script>' + teacher + '</script>');
const gate = read('apps-script', 'leadership', 'Gate.html');
if (!page.includes('</body>')) throw new Error('Could not find the faculty page body.');
page = page.replace('</body>', gate + '</body>');
const setup = read('apps-script', 'leadership', 'Setup.html');
const server = read('apps-script', 'leadership', 'Server.gs');
const transport = read('apps-script', 'leadership', 'PortalTransport.js');
const portalPage = page.replace('<script>' + teacher + '</script>', '<script>' + transport + '</script><script>' + teacher + '</script>')
  .replace('<base target="_blank">', '')
  .replace('href="#" target="_self"', 'href="./"')
  .replace('Open the authenticated faculty dashboard for live Google Sheet data, or import a private Grade Hub JSON snapshot.', 'Live course data is protected by your faculty access code.');
fs.writeFileSync(path.join(root, 'site', 'faculty.html'), portalPage);
const shared = read('site','teacher','analytics.js') + '\n' + read('apps-script','leadership','StudentInsights.js');
const bundle = shared + '\n' + server + '\nconst LEADERSHIP_DASHBOARD_HTML_ = ' + JSON.stringify(page) + ';\nconst LEADERSHIP_SETUP_HTML_ = ' + JSON.stringify(setup) + ';\n';
const out = path.join(root, 'apps-script', 'leadership', 'Bundle.gs');
fs.writeFileSync(out, bundle);
console.log('Built standalone leadership Apps Script bundle. No access code is embedded.');
