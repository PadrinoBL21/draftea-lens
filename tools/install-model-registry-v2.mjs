import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function patchAppModule() {
  const appModulePath = path.join(repoRoot, 'apps/api/src/app.module.ts');
  let content = fs.readFileSync(appModulePath, 'utf8');

  if (!content.includes("./model-registry/model-registry.module")) {
    content = content.replace(
      /\n@Module\(/,
      "\nimport { ModelRegistryModule } from './model-registry/model-registry.module';\n\n@Module(",
    );
  }

  if (!content.includes('ModelRegistryModule,')) {
    content = content.replace(/imports:\s*\[/, 'imports: [\n    ModelRegistryModule,');
  }

  fs.writeFileSync(appModulePath, content);
}

function patchPackageScripts() {
  const apiPackagePath = path.join(repoRoot, 'apps/api/package.json');
  const rootPackagePath = path.join(repoRoot, 'package.json');

  const apiPkg = readJson(apiPackagePath);
  apiPkg.scripts = apiPkg.scripts ?? {};
  apiPkg.scripts['qa:model-registry'] = 'node test/qa-model-registry-v2.mjs';
  writeJson(apiPackagePath, apiPkg);

  const rootPkg = readJson(rootPackagePath);
  rootPkg.scripts = rootPkg.scripts ?? {};
  rootPkg.scripts['qa:model-registry'] = 'pnpm --filter @draftea-lens/api run qa:model-registry';

  const qaCommand = rootPkg.scripts.qa;
  if (typeof qaCommand === 'string' && !qaCommand.includes('qa:model-registry')) {
    if (qaCommand.includes('pnpm run qa:docker')) {
      rootPkg.scripts.qa = qaCommand.replace('pnpm run qa:docker', 'pnpm run qa:model-registry && pnpm run qa:docker');
    } else {
      rootPkg.scripts.qa = `${qaCommand} && pnpm run qa:model-registry`;
    }
  }

  writeJson(rootPackagePath, rootPkg);
}

patchAppModule();
patchPackageScripts();

console.log('Model Registry v2 installed: AppModule and QA scripts patched.');
