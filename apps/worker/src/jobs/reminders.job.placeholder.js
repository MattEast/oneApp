// Placeholder boundary for reminder scheduling and delivery jobs.
module.exports = {
  jobType: 'reminders',
  owner: 'apps/worker',
  trigger: 'scheduled',
  notes: 'Replace with BullMQ processor implementation during worker runtime story.'
};
