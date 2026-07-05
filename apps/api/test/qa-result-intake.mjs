import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixturePath = new URL('./fixtures/result-intake-match.sample.json', import.meta.url);
const fixture = JSON.parse(await readFile(fixturePath, 'utf-8'));

assert.equal(fixture.resultIntakeVersion, 'result-intake-v0.1');
assert.equal(typeof fixture.matchRunId, 'string');
assert.equal(Array.isArray(fixture.candidates), true);
assert.equal(fixture.candidates.length > 0, true);

const [candidate] = fixture.candidates;
assert.equal(candidate.status, 'matched_high_confidence');
assert.equal(candidate.suggestedSettlement.result, 'win');
assert.equal(candidate.suggestedSettlement.confidence, 'high');
assert.equal(candidate.result.status, 'final');
assert.equal(typeof candidate.result.homeScore, 'number');
assert.equal(typeof candidate.result.awayScore, 'number');

console.log(`QA result intake passed: ${fixture.matchRunId} validated with ${fixture.candidates.length} candidate(s).`);
