# Faculty access-code dashboard

Published 2026-11-01. This standalone Apps Script project leaves the student API and original owner-only faculty project intact.

Project: https://script.google.com/home/projects/1oIUHHGVa1GlpAfcuuFKls0vMt7l__WbCd94Q8CNz8qtVq7D9Bvrnx_eM/edit
Public backend deployment (version 6): https://script.google.com/macros/s/AKfycbzughLfW4vcpW4eujWa4CDf87O7rurrAAi1kMTQ8s8utUwJX6CN0M0wdxIHvozqQ_JQ/exec
Private owner settings: https://script.google.com/a/macros/galgotiasuniversity.edu.in/s/AKfycbx5S59dZZcCvtiCBKD9JoToYzN12S0KVxZI6u8pfE-zyK4hGHXNyZ3NPKg1YEnYSNTY/exec?view=setup

The owner enters and activates a six-digit code or generates a longer random code. The actual code is not included in source. Only a salted SHA-256 digest is stored in Script Properties. The code lasts until revoked or replaced. Sessions last 30 minutes; manual lock, code rotation and revocation invalidate subsequent server requests. Already copied or exported data cannot be recalled. Predictable six-digit codes provide weak protection; this temporary choice was explicitly requested by the owner.

Google deployment access is Anyone, executing as the owner. Every data request validates a random session token on the server. Settings and connection diagnostics independently check the owner's account. The public page never embeds the private class dataset. The manifest limits spreadsheet permission to read-only, plus email and external requests. That read permission covers all Sheets available to the account; the code queries only the configured workbook and sends its OAuth token only to sheets.googleapis.com. The Google Sheets advanced service enables the API in the default Cloud project.

The frontend keeps the code screen visible until authenticated data loads. Temporary data errors offer Retry rather than clearing the session; refresh failures retain the previous view with an error message. Expired or revoked sessions clear the view and return to the code screen.

Build: node student-grade-hub/scripts/build-leadership.cjs
Checks: node student-grade-hub/scripts/test-leadership.cjs and node student-grade-hub/scripts/test-faculty-gate.cjs

Mock checks cover unauthorized reads, owner guards, code validation, hashed storage, rotation, revocation during a read, throttling, initial loading, retries and expiry. Live checks verified the published code screen and successful login loading 105 learners and 26 activity definitions. A separate signed-out browser was not tested. The global login throttle can be triggered by repeated incorrect attempts, and Google cache may expire sessions early.

The portal homepage link was published in Git commit 0ddc9e71c930fdd4720fc9bcab2e5fa395b0c96c. No access code, roster or grades were committed.

## Portal interface migration — 2026-11-01

Faculty interface: https://vipulshahi-ai.github.io/student-grade-hub/faculty.html
The homepage Faculty card now opens this page. The Google Apps Script banner does not appear on the portal-hosted interface. The existing Apps Script page remains available for compatibility.

The build helper generates faculty.html from the existing faculty renderer, the access-code gate and PortalTransport.js. The transport sends login/data/lock requests as text/plain HTTPS POST bodies and follows Google's ContentService redirects. Codes and session tokens are not embedded in URLs or browser storage. doPost only dispatches these three operations; it cannot configure or revoke the owner's code. Data requests retain all prior server-side session checks and revocation behavior.

Backend version 6 deployed successfully. Browser verification from the GitHub Pages origin confirmed code login, 105 learners / 26 activity definitions, successful refresh without navigation, and Lock dashboard returning to the code prompt. Automated checks additionally cover malformed POST bodies, unauthenticated data requests and rejection of owner-operation names over HTTP.

Frontend page commit: c5b8cf0. Homepage link commit: aaa8862.

## Student standings and reflections — 2026-11-02

The existing no-PIN student lookup now uses the public POST student operation on this backend. Only the requested student's report, anonymous top-10 entries (including ties), and cohort aggregates are returned. The server computes everything with the same analytics module used by the faculty page. No class roster or raw peer ledger reaches the student browser. Names and identifiers quoted about other learners in the requested student's own feedback are masked in that student response only.

StudentInsights.js projects section/overall/topic ranks, class averages, timing coverage, topic evidence, participation, submitted-work average, and rule-based reflections. Rank ties use competition ranks (1,2,2,4) on the same score precision displayed. Overall includes each applicable visible activity equally, with missing work zero. Submitted zero remains submitted. No graded evidence is unclassified; unknown timing stays unknown. Mixed-topic assessments retain the teacher mapping. Comparability across sections is explicitly noted.

Aliases derive from an independently generated private salt in Script Properties (STUDENT_ALIAS_SALT). They remain stable across access-code rotation and are not derived from public row numbers. Owner-only settings and faculty data access retain their existing guards. The original student API remains in use only for grade queries. No new grading sheet is required; no rank-movement claims are made without history.

Checks: node student-grade-hub/scripts/test-student-insights.cjs tests all 105 saved reports against faculty analytics, privacy field projection and peer identifiers, section eligibility, submitted zero, no evidence, shared ranks, and ties at tenth position. Live browser verification is recorded separately after publication.
