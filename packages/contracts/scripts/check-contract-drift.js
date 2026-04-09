const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve(__dirname, '../../../docs/openapi.yaml');
const artifactPath = path.resolve(__dirname, '../openapi/openapi.yaml');

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

const source = readText(sourcePath);
const artifact = readText(artifactPath);

if (source === null) {
  console.error('Contract drift check failed: docs/openapi.yaml is missing.');
  process.exit(1);
}

if (artifact === null) {
  console.error('Contract drift check failed: packages/contracts/openapi/openapi.yaml is missing.');
  console.error('Run: npm --prefix packages/contracts run sync:openapi');
  process.exit(1);
}

if (source !== artifact) {
  console.error('Contract drift check failed: shared artifact is out of date.');
  console.error('Run: npm --prefix packages/contracts run sync:openapi');
  process.exit(1);
}

console.log('Contract drift check passed: shared OpenAPI artifact is in sync.');
