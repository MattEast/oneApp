// Placeholder boundary for background bank sync orchestration jobs.
module.exports = {
  jobType: 'bank-sync',
  owner: 'apps/worker',
  trigger: 'event-or-scheduled',
  notes: 'Use for sync retries and reconciliation outside request-response flows.'
};
