import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/app/dashboard/dashboard.types.ts',
  'src/app/dashboard/dashboard-api.service.ts',
  'src/app/dashboard/dashboard-panel.component.ts',
];

for (const file of requiredFiles) {
  const path = join(root, file);
  if (!existsSync(path)) {
    throw new Error(`Missing dashboard file: ${file}`);
  }
}

const service = readFileSync(join(root, 'src/app/dashboard/dashboard-api.service.ts'), 'utf8');
const component = readFileSync(join(root, 'src/app/dashboard/dashboard-panel.component.ts'), 'utf8');

const endpoints = [
  '/dashboard/overview',
  '/dashboard/backtesting',
  '/dashboard/collection',
  '/dashboard/models',
  '/dashboard/risks',
];

for (const endpoint of endpoints) {
  if (!service.includes(endpoint)) {
    throw new Error(`Dashboard service does not call ${endpoint}`);
  }
}

const componentChecks = [
  'selector: \'app-dashboard-panel\'',
  'Dashboard del sistema',
  'Champion',
  'Riesgos actuales',
  'refreshAll()'
];

for (const check of componentChecks) {
  if (!component.includes(check)) {
    throw new Error(`Dashboard component missing expected content: ${check}`);
  }
}

console.log('QA dashboard web UI passed: dashboard component and API service validated.');
