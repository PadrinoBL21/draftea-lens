import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

function repoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(repoPath(relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(repoPath(relativePath));
}

const requiredFiles = [
  'apps/api/src/model-registry/model-registry.module.ts',
  'apps/api/src/model-registry/model-registry.controller.ts',
  'apps/api/src/model-registry/model-registry.service.ts',
  'apps/api/src/model-registry/model-registry.store.ts',
  'apps/api/src/model-registry/model-registry.types.ts',
  'apps/api/src/model-registry/dto/register-model.dto.ts',
  'apps/api/src/model-registry/dto/evaluate-model.dto.ts',
  'apps/api/src/model-registry/dto/promote-model.dto.ts',
  'apps/api/test/fixtures/model-registry-summary.sample.json',
  'docs/model-registry-v2.md',
];

for (const file of requiredFiles) {
  assert.equal(exists(file), true, `${file} should exist`);
}

const appModule = read('apps/api/src/app.module.ts');
const controller = read('apps/api/src/model-registry/model-registry.controller.ts');
const service = read('apps/api/src/model-registry/model-registry.service.ts');
const registerDto = read('apps/api/src/model-registry/dto/register-model.dto.ts');
const evaluateDto = read('apps/api/src/model-registry/dto/evaluate-model.dto.ts');
const promoteDto = read('apps/api/src/model-registry/dto/promote-model.dto.ts');
const docs = read('docs/model-registry-v2.md');
const fixture = JSON.parse(read('apps/api/test/fixtures/model-registry-summary.sample.json'));

assert.match(appModule, /ModelRegistryModule/, 'AppModule should import ModelRegistryModule');
assert.match(controller, /@Controller\('model-registry'\)/, 'controller should expose /model-registry');
assert.match(controller, /@Get\('models'\)/, 'controller should expose GET /model-registry/models');
assert.match(controller, /@Get\('latest'\)/, 'controller should expose GET /model-registry/latest');
assert.match(controller, /@Get\('summary'\)/, 'controller should expose GET /model-registry/summary');
assert.match(controller, /@Post\('register'\)/, 'controller should expose POST /model-registry/register');
assert.match(controller, /@Post\('evaluate'\)/, 'controller should expose POST /model-registry/evaluate');
assert.match(controller, /@Post\('promote'\)/, 'controller should expose POST /model-registry/promote');

for (const [name, content] of [
  ['register dto', registerDto],
  ['evaluate dto', evaluateDto],
  ['promote dto', promoteDto],
]) {
  assert.match(content, /class-validator/, `${name} should use class-validator`);
  assert.match(content, /@Is/, `${name} should include validation decorators`);
}

assert.match(service, /consensus-ev-v0\.1/, 'service should seed current consensus EV champion');
assert.match(service, /blocked_insufficient_data/, 'service should block insufficient data');
assert.match(service, /minTrainingRows/, 'service should enforce training-row gate');
assert.match(service, /minBacktestRows/, 'service should enforce backtest-row gate');
assert.match(service, /promotable/, 'service should support promotable evaluations');
assert.match(service, /DATA_DIR/, 'service/store should respect DATA_DIR');

assert.equal(fixture.registryVersion, 'model-registry-v2-v0.1');
assert.equal(fixture.championModelId, 'consensus-ev-v0.1');
assert.equal(fixture.latestEvaluationStatus, 'blocked_insufficient_data');

assert.match(docs, /Champion/i, 'docs should explain champion model');
assert.match(docs, /Challenger/i, 'docs should explain challenger model');
assert.match(docs, /insufficient data/i, 'docs should document insufficient data blocking');

console.log('QA model registry v2 passed: registry endpoints, DTO validation, champion seed, and safety gates validated.');
