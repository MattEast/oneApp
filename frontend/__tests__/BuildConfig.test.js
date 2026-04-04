const fs = require('fs');
const path = require('path');

describe('Frontend build configuration guardrails', () => {
  test('does not include a custom .babelrc file', () => {
    const babelrcPath = path.resolve(__dirname, '..', '.babelrc');
    expect(fs.existsSync(babelrcPath)).toBe(false);
  });
});
