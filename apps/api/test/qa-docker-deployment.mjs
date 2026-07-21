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
  'Dockerfile.api',
  'Dockerfile.web',
  'docker-compose.yml',
  '.dockerignore',
  '.env.example',
  '.env.aws.example',
  '.env.royalserver.example',
  'pnpm-workspace.yaml',
  'docs/deployment-aws.md',
  'docs/deployment-ubuntu-homelab.md',
  'docs/docker-pnpm.md',
  'docs/multi-server-strategy.md',
];

for (const file of requiredFiles) {
  assert.equal(exists(file), true, `${file} should exist`);
}

const apiDockerfile = read('Dockerfile.api');
const webDockerfile = read('Dockerfile.web');
const compose = read('docker-compose.yml');
const workspace = read('pnpm-workspace.yaml');
const envAws = read('.env.aws.example');
const envRoyalServer = read('.env.royalserver.example');
const dockerignore = read('.dockerignore');

for (const [name, content] of [
  ['Dockerfile.api', apiDockerfile],
  ['Dockerfile.web', webDockerfile],
]) {
  assert.match(content, /corepack/i, `${name} should enable corepack`);
  assert.match(content, /pnpm/i, `${name} should use pnpm`);
  assert.doesNotMatch(content, /\bnpm\s+install\b/i, `${name} should not use npm install`);
}

assert.match(workspace, /packages:/, 'pnpm-workspace.yaml should define packages');
assert.match(workspace, /apps\/\*/, 'pnpm-workspace.yaml should include apps/*');
assert.match(workspace, /packages\/\*/, 'pnpm-workspace.yaml should include packages/*');
assert.match(workspace, /allowBuilds:/, 'pnpm-workspace.yaml should include approved build scripts');

assert.match(compose, /api:/, 'docker-compose.yml should define api service');
assert.match(compose, /web:/, 'docker-compose.yml should define web service');
assert.match(compose, /API_PORT|3010/, 'docker-compose.yml should support API_PORT or default 3010');
assert.match(compose, /WEB_PORT|4210/, 'docker-compose.yml should support WEB_PORT or default 4210');
assert.doesNotMatch(compose, /8081\s*:/, 'docker-compose.yml should not bind to parroquia port 8081');

for (const [name, content] of [
  ['.env.aws.example', envAws],
  ['.env.royalserver.example', envRoyalServer],
]) {
  assert.match(content, /SERVER_ID=/, `${name} should define SERVER_ID`);
  assert.match(content, /SERVER_ROLE=/, `${name} should define SERVER_ROLE`);
  assert.match(content, /API_PORT=/, `${name} should define API_PORT`);
  assert.match(content, /WEB_PORT=/, `${name} should define WEB_PORT`);
  assert.match(content, /COLLECTOR_ENABLED=/, `${name} should define COLLECTOR_ENABLED`);
  assert.match(content, /SCHEDULER_ENABLED=/, `${name} should define SCHEDULER_ENABLED`);
}

assert.match(envAws, /aws-main/, '.env.aws.example should identify AWS server');
assert.match(envRoyalServer, /royalserver-lab/, '.env.royalserver.example should identify RoyalServer lab');

assert.match(dockerignore, /node_modules/, '.dockerignore should ignore node_modules');
assert.match(dockerignore, /\.git/, '.dockerignore should ignore .git');
assert.match(dockerignore, /\.env/, '.dockerignore should ignore local env files');

console.log('QA docker deployment passed: pnpm Dockerfiles, multi-server envs, compose ports, and safety guards validated.');
