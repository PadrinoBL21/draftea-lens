import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/training-dataset-export.sample.json', import.meta.url), 'utf-8'),
);

assert.equal(fixture.datasetVersion, 'training-dataset-export-v0.1');
assert.equal(fixture.filters.format, 'both');
assert.equal(fixture.rowsExported, 2);
assert.equal(fixture.trainingEligibleRows, 2);
assert.equal(fixture.positiveLabels, 1);
assert.equal(fixture.negativeLabels, 1);
assert.equal(fixture.sample[0].labelWin, 1);
assert.equal(fixture.sample[0].labelWeight, 1);
assert.equal(fixture.sample[0].features.sourcePaperPick, 1);
assert.ok(fixture.saved.jsonlPath.endsWith('.jsonl'));
assert.ok(fixture.saved.csvPath.endsWith('.csv'));

console.log(
  `QA training dataset export passed: ${fixture.exportId} validated with ${fixture.rowsExported} exported row(s).`,
);
