const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve(__dirname, '../../../docs/openapi.yaml');
const targetPath = path.resolve(__dirname, '../openapi/openapi.yaml');

if (!fs.existsSync(sourcePath)) {
  console.error('OpenAPI sync failed: docs/openapi.yaml is missing.');
  process.exit(1);
}

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.copyFileSync(sourcePath, targetPath);

console.log('Synced docs/openapi.yaml to packages/contracts/openapi/openapi.yaml');
