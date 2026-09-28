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
- A blank mark becomes **Not submitted**. Any recorded mark becomes **Submitted**.
- The ledger calculates every activity as `marks ÷ maximum marks × 100`; `Current_Standing` averages those normalized activities equally.

The student UI intentionally has no leaderboard and no review-status label. It only shows submission status, scores, and feedback.
