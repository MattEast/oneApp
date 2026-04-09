const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

describe('Frontend build smoke test', () => {
  const frontendDir = path.resolve(__dirname, '..');
  const distDir = path.join(frontendDir, 'dist');

  afterAll(() => {
    // Clean up the build output
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  it('parcel build completes without errors', () => {
    // Remove stale dist to ensure a clean build
    fs.rmSync(distDir, { recursive: true, force: true });

    execFileSync('npx', ['parcel', 'build', 'index.html'], {
      cwd: frontendDir,
      stdio: 'pipe',
      timeout: 60_000
    });

    expect(fs.existsSync(distDir)).toBe(true);

    const files = fs.readdirSync(distDir);
    expect(files.some(f => f.endsWith('.html'))).toBe(true);
    expect(files.some(f => f.endsWith('.js'))).toBe(true);
  });
});
