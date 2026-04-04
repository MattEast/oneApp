const fs = require('fs');
const path = require('path');

const openApiPath = path.resolve(__dirname, '../../../docs/openapi.yaml');

if (!fs.existsSync(openApiPath)) {
  console.error('OpenAPI contract file not found at docs/openapi.yaml');
  process.exit(1);
}

const contract = fs.readFileSync(openApiPath, 'utf8').trim();

if (!contract.startsWith('openapi:')) {
  console.error('OpenAPI contract does not appear to start with an openapi version header.');
  process.exit(1);
}

if (!contract.includes('paths:')) {
  console.error('OpenAPI contract is missing a paths section.');
  process.exit(1);
}

console.log('OpenAPI contract presence check passed for docs/openapi.yaml');
