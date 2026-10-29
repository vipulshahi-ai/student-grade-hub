# Student Grade Hub

This folder contains the two parts of the student report:

- `apps-script/Code.gs` — API and staff grade-sync automation, bound to the Google Sheet.
- `site/` — static student UI, ready to publish on GitHub Pages.

## Deploy the API

1. Open the Grade Hub spreadsheet and select **Extensions → Apps Script**.
2. Replace the default script with `apps-script/Code.gs`, save, and authorize when Google prompts.
3. Click **Deploy → New deployment → Web app**.
4. Set **Execute as** to your account and **Who has access** to the audience you want students to use. Copy the URL ending in `/exec`.
5. Paste that URL into `site/config.js`.

The web app serves a student report by admission or enrollment number. Its JSONP support lets the GitHub Pages site access Apps Script without browser cross-origin issues.

## Publish the UI on GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. Confirm `site/config.js` contains the deployed Apps Script `/exec` URL before pushing; this is public configuration, not a secret.
3. In the repository, open **Settings → Pages** and select **GitHub Actions** as the publishing source.
4. The included `.github/workflows/deploy-student-grade-hub.yml` publishes `student-grade-hub/site` after every relevant push. The completed workflow shows the live Pages URL.

`netlify.toml` is retained only as an optional alternative; GitHub Pages needs no build command.

## Staff workflow

- Enter marks and student-visible feedback in an `A## ...` activity tab.
- Use **Grade Hub → Sync current activity tab** (or sync all tabs).
- For a new weekly activity, add its row to `Activities`, create an `A## ...` tab using an existing activity tab as the header/roster template, then run sync. The script creates its missing `Student_Activity` rows automatically.
- An explicit **Not submitted** status is respected, including prefilled zero marks. A recorded zero with **Submitted** status remains submitted.
- The ledger calculates every activity as `marks ÷ maximum marks × 100`; `Current_Standing` averages those normalized activities equally.
- The student portal calculates its equal-weight score directly from the same activity rows it displays, so newly synced records are reflected immediately.
- The chart uses green for on-time submissions, yellow for late submissions, and red for no submission. Audited `Submission Timing` and `Timing Evidence` fields are in ledger columns N:O. `Unknown` uses a neutral marker for retained grades without timestamp evidence. Explicit timing takes precedence over old feedback wording.
- Students may select multiple missing or zero-score activities and submit one grade query. The first query creates a `Grade_Queries` tab with a staff-review status column.

The student UI intentionally has no leaderboard and no review-status label. It only shows submission status, scores, and feedback.

## Faculty analytics

`site/teacher/` is a separate faculty analytical workspace: topic comparisons,
top-10 rankings, section filters, participation bands, intervention lists,
quiz/practical gaps, learner drill-downs, CSV export and audit coverage.
The public static files contain no class dataset. Live data is loaded only
inside the authenticated Apps Script faculty page (`?action=teacher`).
`getTeacherData()` checks the active Google user's exact faculty email before
reading the class data. Anonymous callers and student accounts are denied.

The separate faculty web app deployment is restricted to **Only myself**. Its address is provided privately to the faculty owner. The student API remains a separate public deployment. Faculty data refreshes from the backend on opening and through **Refresh from sheet**.

Deploy both `Code.gs` and `Teacher.gs` in the existing Apps Script project.
The `Teacher_Topics` sheet overrides activity-to-topic mappings. Mixed-topic
assessments remain grouped until question-level marks are available.
The `Teacher_Audit` sheet records dated reconciliation and closure checks.

Participation bands are Active (at least 80% submitted), Intermediate active
(50–79.9%) and Low active (below 50%). Submitted average is kept distinct
from overall performance with missing work included. Performance has three
levels based on submitted average: High (at least 80), Intermediate (50–79.9)
and Low (below 50). Students without graded submissions display a dash;
there is no fourth performance level or learning-speed classification.
