function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return undefined;
  }

  const [localPart, domain] = email.split('@');
  const visiblePrefix = localPart.slice(0, 2);

  return `${visiblePrefix}${'*'.repeat(Math.max(localPart.length - visiblePrefix.length, 1))}@${domain}`;
}

function writeLog(level, event, context = {}) {
  if (process.env.NODE_ENV === 'test' && process.env.ONEAPP_ENABLE_TEST_LOGS !== 'true') {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context
  };

  const serialized = JSON.stringify(payload);

  if (level === 'error') {
    console.error(serialized);
    return;
  }

  if (level === 'warn') {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

function logInfo(event, context) {
  writeLog('info', event, context);
}

function logWarn(event, context) {
  writeLog('warn', event, context);
}

function logError(event, context) {
  writeLog('error', event, context);
}

module.exports = {
  logError,
  logInfo,
  logWarn,
  maskEmail
};