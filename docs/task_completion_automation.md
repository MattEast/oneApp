# Task Completion Automation

This project uses both a markdown log (docs/completed_tasks.md) and a CSV (docs/jira_import.csv) to track completed tasks. To automate marking tasks as completed in both files:

## How it works
- Before implementation starts, add new work to the backlog in `docs/jira_import.csv` and, where relevant, `docs/jira_import_aligned.csv`.
- New work should not begin as undocumented scope. Capture the story or task first, then implement it.
- When a task is completed, update both docs/completed_tasks.md and docs/jira_import.csv.
- The CSV must have a 'Completed' column. Mark completed tasks with 'Yes'.
- The markdown file should log the date, task, and details.
- If a task is deprecated or deferred, update the relevant documentation and API contract in the same change instead of marking the customer-facing behavior as completed.

## Ways Of Working Improvements (Retro: 2026-04-04)
- Use one branch per planned unit of work:
  - story work: `story/<id>-<slug>`
  - bug work: `fix/<bug-id>-<slug>`
  - maintenance/docs work: `chore/<slug>` or `docs/<slug>`
- Do not push direct implementation changes to `master`; use a pull request with required checks.
- For each discovered defect, add or update an entry in `docs/bugs.csv` with: steps to reproduce, route, root cause, and fix implemented.
- Definition of done for bug fixes must include a regression test that fails without the fix.
- For auth and startup-sensitive changes, run process-level smoke checks before closing work:
  - `GET /health` returns `200`
  - demo sign-in (`demo@oneapp.local`) succeeds through `POST /api/login`
- Keep one backend terminal session running during manual login checks; avoid repeated port-kill loops unless intentionally restarting the service.

## Automation Script (Node.js Example)

You can use a Node.js script to automate this process. Use a real CSV parser rather than splitting on commas so quoted descriptions and multiline fields remain intact. Place this script in your project root as update_completed_tasks.js:

```js
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const csvPath = 'docs/jira_import.csv';
const mdPath = 'docs/completed_tasks.md';
const today = new Date().toISOString().slice(0, 10);

function markTaskCompleted(summary, details = '') {
  const csvRows = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
  });

  for (const row of csvRows) {
    if (row.Summary && row.Summary.trim() === summary && row.Completed !== 'Yes') {
      row.Completed = 'Yes';
      break;
    }
  }

  fs.writeFileSync(csvPath, stringify(csvRows, { header: true }));

  // Update Markdown
  let md = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '# Completed Tasks\n\n| Date | Task | Details |\n|------|------|---------|\n';
  if (!md.includes(summary)) {
    md += `| ${today} | ${summary} | ${details} |\n`;
    fs.writeFileSync(mdPath, md);
  }
}

// Example usage:
// markTaskCompleted('Implement backend login endpoint', 'login.test.js, README, OpenAPI updated');

module.exports = { markTaskCompleted };
```

Install dependencies before using the script:

```bash
npm install csv-parse csv-stringify
```

## Usage
- Add backlog entries before starting implementation work for any new scope, architectural requirement, or cross-cutting task.
- Call `markTaskCompleted('Task Summary', 'Details')` whenever a task is finished.
- This will update both the CSV and markdown log automatically.
- For deprecated work, add a markdown log entry explaining the deprecation and update roadmap documents separately.

---

You can expand this script to handle more fields, sync with project boards, track deprecated items, or integrate with CI/CD as needed.
