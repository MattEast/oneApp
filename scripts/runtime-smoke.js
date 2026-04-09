const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const START_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 300;

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function makeRequest({ method, port, requestPath, body }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: requestPath,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload)
            }
          : undefined,
        timeout: 3000
      },
      res => {
        let raw = '';
        res.on('data', chunk => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch (error) {
            parsed = null;
          }

          resolve({
            statusCode: res.statusCode,
            body: parsed,
            rawBody: raw
          });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

async function waitForCheck(name, check, timeoutMs = START_TIMEOUT_MS) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await check();
      return;
    } catch (error) {
      lastError = error;
      await sleep(POLL_INTERVAL_MS);
    }
  }

  throw new Error(`${name} did not become ready in time. Last error: ${lastError ? lastError.message : 'unknown error'}`);
}

function startProcess(name, cwd, args, extraEnv = {}) {
  const child = spawn(npmCommand(), args, {
    cwd,
    env: {
      ...process.env,
      ...extraEnv
    },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', chunk => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', chunk => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on('exit', code => {
    if (code !== null && code !== 0) {
      process.stderr.write(`[${name}] exited with code ${code}\n`);
    }
  });

  return child;
}

function stopProcess(child) {
  return new Promise(resolve => {
    if (!child) {
      resolve();
      return;
    }

    if (child.exitCode !== null) {
      resolve();
      return;
    }

    child.once('exit', () => resolve());

    if (process.platform !== 'win32') {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch (error) {
        resolve();
        return;
      }
    } else {
      child.kill('SIGTERM');
    }

    setTimeout(() => {
      if (child.exitCode === null) {
        if (process.platform !== 'win32') {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch (error) {
            // Process group likely already exited.
          }
        } else {
          child.kill('SIGKILL');
        }
      }
      resolve();
    }, 3000);
  });
}

async function run() {
  const repoRoot = path.resolve(__dirname, '..');
  const frontendDir = path.join(repoRoot, 'frontend');
  const backendDir = path.join(repoRoot, 'backend');
  const backendPort = await getFreePort();
  const frontendPort = await getFreePort();

  let frontendProcess;
  let backendProcess;

  try {
    backendProcess = startProcess('backend', backendDir, ['start'], {
      PORT: String(backendPort),
      NODE_ENV: 'test',
      ONEAPP_ENABLE_TEST_LOGS: 'true'
    });

    await waitForCheck('backend health check', async () => {
      const response = await makeRequest({ method: 'GET', port: backendPort, requestPath: '/health' });
      if (response.statusCode !== 200 || !response.body || response.body.status !== 'ok') {
        throw new Error(`Expected 200 {status: ok}, got ${response.statusCode} ${response.rawBody}`);
      }
    });

    await waitForCheck('versioned API login route', async () => {
      const response = await makeRequest({
        method: 'POST',
        port: backendPort,
        requestPath: '/api/v1/login',
        body: {
          email: 'demo@oneapp.local',
          password: 'DemoPass123!'
        }
      });

      if (response.statusCode !== 200 || !response.body || !response.body.data || !response.body.data.token) {
        throw new Error(`Expected 200 demo login response with token, got ${response.statusCode} ${response.rawBody}`);
      }
    });

    frontendProcess = startProcess('frontend', frontendDir, ['start', '--', '--port', String(frontendPort)]);

    await waitForCheck('frontend /dashboard', async () => {
      const response = await makeRequest({ method: 'GET', port: frontendPort, requestPath: '/dashboard' });
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200 from frontend route, got ${response.statusCode}`);
      }
    });

    process.stdout.write('Runtime smoke check passed. Frontend and backend were both reachable with expected responses.\n');
  } finally {
    await stopProcess(frontendProcess);
    await stopProcess(backendProcess);
  }
}

run().catch(error => {
  process.stderr.write(`Runtime smoke check failed: ${error.message}\n`);
  process.exit(1);
});
