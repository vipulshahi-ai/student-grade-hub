# Student insights and leaderboard proposal

The portal homepage is the shared entry point. Student reports remain on `student.html`; the faculty card opens the authenticated faculty workspace. The leaderboard below is proposed, not yet published.

## Student dashboard additions

| Insight | Student sees | Purpose |
|---|---|---|
| My section rank | Rank out of eligible classmates | A fair primary comparison within the same section |
| My overall rank | Rank across both sections, with cohort size | Current standing across the course |
| Topic standing | Own topic score, section average and topic rank | Identify strengths and topics needing practice |
| Participation | Submitted / expected activities and on-time / late / missing counts | Separate coverage from understanding |
| Performance level | High, Intermediate or Low using submitted-work average | Match the faculty dashboard's three levels |
| My next steps | Missing-work checks, weaker submitted topics and existing teacher comments | Turn the report into a practical action list |
| Distance to the top 10 | Score difference from the current top-10 threshold | A concrete benchmark, without promising future rank |

Keep the existing activity chart, detailed feedback and multi-select grade query form. Topic scores must use the reviewed Teacher_Topics mapping. Broad assessments stay mixed-topic groups; do not invent question-level topic marks.

## Recommended leaderboard

- Show a student's own section rank prominently, then overall rank. Topic rank follows the selected topic.
- Offer top 10 overall, top 10 in the student's section, and top 10 for a selected topic.
- Use aliases for peer entries by default. Show the current student's own entry as "You". Do not show admission numbers, enrollment numbers, teacher comments, missing-activity details or bottom-ranked student lists for peers.
- Before publishing identifiable peer scores, agree on whether names are allowed and who can view the board. Start with a private personal-rank panel and aggregate comparisons if public peer listings are not wanted.
- Rank using the existing equal-weight overall score: normalize each eligible activity to 100, include missing work as zero, then average. Do not rank by submitted-only average: one completed activity should not outrank consistent full participation merely because it scored 100.
- Equal scores receive equal ranks, using competition ranking (1, 2, 2, 4). Use the same displayed score precision for ties so students are not shown indistinguishable scores with different ranks.
- Include ties at the top-10 boundary, even if that produces more than ten entries. Label the board "Top 10 ranks" when necessary.
- Apply section eligibility and the same activity set used by each report. Section rankings are primary because sections can have different quiz questions. Overall rankings need this comparability note.
- Display the refresh time, number of eligible students and scoring rule. Rankings should recalculate from the sheet when a report is requested, without a manual frontend update.

## Data and API approach

Compute comparisons on the server from Students, Activities and Student_Activity. Extend the existing per-student report with only that student's rank, cohort counts, aggregate averages and topic comparisons. Do not send the full roster or private ledger to the student browser.

For a peer top-10 board, return a deliberately limited result containing rank, approved alias, permitted section label and leaderboard score. Keep the faculty's full dataset behind its current account check. Preserve the existing no-PIN lookup until the course owner changes that requirement.

Do not claim rank improvement or a performance trend from a single snapshot. Add a dated Ranking_History or Progress_History tab before showing movement over time. Submission streaks and badges also need reliable activity dates and explicit timing; missing evidence must not be counted as on time.

## Rollout and checks

1. Shared homepage and existing dashboard navigation.
2. Personal rank, class comparison, topic strengths and next-step insights.
3. Approved top-10 leaderboard presentation.
4. Historical progress after enough dated snapshots exist.

Validate ties, the top-10 boundary, different section activity IDs, newly added activities, graded zero versus non-submission, no-submission students and late submissions. Compare each student's displayed score and rank against the same backend calculation. The leaderboard must not change any LMS marks or apply additional late penalties.
