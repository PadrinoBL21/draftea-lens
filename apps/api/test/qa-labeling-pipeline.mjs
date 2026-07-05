import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/labeling-rebuild.sample.json', import.meta.url), 'utf-8'),
);

assert.equal(fixture.labelingVersion, 'labeling-pipeline-v0.1');
assert.equal(fixture.labelsBuilt, 3);
assert.equal(fixture.trainingEligibleLabels, 2);
assert.equal(fixture.positiveLabels, 1);
assert.equal(fixture.negativeLabels, 1);
assert.equal(fixture.summary.bySettlementResult.win, 1);
assert.equal(fixture.summary.bySettlementResult.loss, 1);
assert.equal(fixture.sample[0].trainingEligible, true);
assert.equal(fixture.sample[0].labelWin, 1);
assert.equal(fixture.sample[0].features.sourcePaperPick, 1);

console.log(
  `QA labeling pipeline passed: ${fixture.rebuildId} validated with ${fixture.trainingEligibleLabels} trainable label(s).`,
);
