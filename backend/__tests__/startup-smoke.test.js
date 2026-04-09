const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

function httpRequest({ method, port, requestPath, body }) {
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
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch (error) {
            parsed = null;
          }

          resolve({
            statusCode: res.statusCode,
            body: parsed,
            rawBody: data
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

async function waitForServer(port, maxAttempts = 40) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await httpRequest({ method: 'GET', port, requestPath: '/health' });
      if (response.statusCode === 200) {
        return;
      }
    } catch (error) {
      // Server not ready yet; retry.
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error('Server did not become healthy in time');
}

describe('Backend startup smoke test', () => {
  let serverProcess;
  const port = 4500 + Math.floor(Math.random() * 300);

  beforeAll(async () => {
    const backendDir = path.resolve(__dirname, '..');

    serverProcess = spawn('node', ['server.js'], {
      cwd: backendDir,
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'test',
        ONEAPP_ENABLE_TEST_LOGS: 'true'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let startupError = '';

    serverProcess.stderr.on('data', chunk => {
      startupError += String(chunk);
    });

    await waitForServer(port);

    if (startupError) {
      throw new Error(`Server emitted startup error output: ${startupError}`);
    }
  }, 10000);

  afterAll(() => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
    }
  });

  test('responds on /health with ok status', async () => {
    const response = await httpRequest({ method: 'GET', port, requestPath: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  test('allows demo login over real HTTP', async () => {
    const response = await httpRequest({
      method: 'POST',
      port,
      requestPath: '/api/v1/login',
      body: {
        email: 'demo@oneapp.local',
        password: 'DemoPass123!'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('token');
    expect(response.body.data).toHaveProperty('expiresIn', 3600);
    expect(response.body.data).toHaveProperty('user');
    expect(response.body.data.user).toEqual({
      fullname: 'Demo Customer',
      email: 'demo@oneapp.local'
    });
  });
});
