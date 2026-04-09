// Placeholder boundary for asynchronous reporting and snapshot generation.
module.exports = {
  jobType: 'reporting',
  owner: 'apps/worker',
  trigger: 'scheduled',
  notes: 'Run longer report workloads asynchronously and persist status for clients.'
};
