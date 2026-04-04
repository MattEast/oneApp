const fs = require('fs');
const path = require('path');

const requiredFiles = [
  path.resolve(__dirname, '../src/jobs/reminders.job.placeholder.js'),
  path.resolve(__dirname, '../src/jobs/bank-sync.job.placeholder.js'),
  path.resolve(__dirname, '../src/jobs/reporting.job.placeholder.js'),
  path.resolve(__dirname, '../src/queue/retry-policy.json')
];

const missing = requiredFiles.filter(filePath => !fs.existsSync(filePath));

if (missing.length > 0) {
  console.error('Worker foundation verification failed. Missing files:');
  missing.forEach(filePath => console.error(`- ${filePath}`));
  process.exit(1);
}

console.log('Worker foundation verification passed.');
