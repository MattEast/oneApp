function sendInvalidSession(res) {
  return res.status(401).json({ error: 'Session is no longer valid. Please sign in again.' });
}

function sendDeprecatedFeature(res, message) {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Tue, 30 Jun 2026 00:00:00 GMT');

  return res.status(410).json({ error: message });
}

module.exports = {
  sendDeprecatedFeature,
  sendInvalidSession
};