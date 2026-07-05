import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const appTsPath = join(root, 'apps/web/src/app/app.component.ts');
const appHtmlPath = join(root, 'apps/web/src/app/app.component.html');
const appCssPath = join(root, 'apps/web/src/app/app.component.css');

function readRequired(path) {
  if (!existsSync(path)) {
    throw new Error(`Required file not found: ${path}`);
  }
  return readFileSync(path, 'utf8');
}

function writeIfChanged(path, before, after) {
  if (before !== after) {
    writeFileSync(path, after);
    console.log(`Updated ${path}`);
  } else {
    console.log(`No changes needed for ${path}`);
  }
}

let appTs = readRequired(appTsPath);
const originalTs = appTs;

if (!appTs.includes("./dashboard/dashboard-panel.component")) {
  appTs = appTs.replace(
    /(^import[\s\S]*?;\s*)\n(?!import)/,
    `$1\nimport { DashboardPanelComponent } from './dashboard/dashboard-panel.component';\n\n`,
  );
}

if (!appTs.includes('DashboardPanelComponent')) {
  throw new Error('Failed to insert DashboardPanelComponent import.');
}

if (/imports\s*:\s*\[[\s\S]*?\]/m.test(appTs) && !/imports\s*:\s*\[[\s\S]*DashboardPanelComponent[\s\S]*?\]/m.test(appTs)) {
  appTs = appTs.replace(/imports\s*:\s*\[([\s\S]*?)\]/m, (match, importsBody) => {
    const trimmed = importsBody.trim();
    const nextBody = trimmed.length > 0 ? `${importsBody.trimEnd()}, DashboardPanelComponent` : 'DashboardPanelComponent';
    return `imports: [${nextBody}]`;
  });
}

writeIfChanged(appTsPath, originalTs, appTs);

let appHtml = readRequired(appHtmlPath);
const originalHtml = appHtml;
const dashboardMarkup = `<section class="dashboard-web-ui-section">\n  <app-dashboard-panel></app-dashboard-panel>\n</section>\n\n`;

if (!appHtml.includes('<app-dashboard-panel')) {
  appHtml = `${dashboardMarkup}${appHtml}`;
}

writeIfChanged(appHtmlPath, originalHtml, appHtml);

let appCss = readRequired(appCssPath);
const originalCss = appCss;
const cssBlock = `

/* Dashboard Web UI */
.dashboard-web-ui-section {
  margin: 0 auto 1.5rem;
  max-width: 1440px;
}
`;

if (!appCss.includes('.dashboard-web-ui-section')) {
  appCss = `${appCss}${cssBlock}`;
}

writeIfChanged(appCssPath, originalCss, appCss);
console.log('Dashboard Web UI installed. Run: npm --workspace apps/web run start');
