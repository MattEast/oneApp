const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const registerRoute = require('./register');
const { logError, logInfo, logWarn } = require('./utils/observability');
const { ensureStartupReadiness, isStartupReadinessError } = require('./startupReadiness');

const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

app.get('/health', (req, res) => {
  return res.status(200).json({ status: 'ok' });
});

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    if (res.statusCode < 400) {
      return;
    }

    const context = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt
    };

    if (res.statusCode >= 500) {
      logError('http.request.failed', context);
      return;
    }

    logWarn('http.request.rejected', context);
  });

  next();
});

app.use('/api/v1', registerRoute);

app.use((error, req, res, next) => {
  logError('http.unhandled_exception', {
    method: req.method,
    path: req.originalUrl,
    message: error.message
  });

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({ error: 'Unexpected server error.' });
});

async function startServer() {
  await ensureStartupReadiness();

  const PORT = process.env.PORT || 4000;

  app.listen(PORT, () => {
    logInfo('server.started', { port: PORT });
  });
}

startServer().catch((error) => {
  if (isStartupReadinessError(error)) {
    logError('server.startup.readiness_failed', {
      message: error.message,
      action: error.details?.action,
      kind: error.details?.kind,
      missingTables: error.details?.missingTables
    });
  } else {
    logError('server.startup.failed', {
      message: error.message
    });
  }

  process.exit(1);
});
