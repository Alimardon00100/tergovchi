import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeOpening } from '../scripts/case-opening-metrics.mjs';

test('reports failed guards, completed scores and unfinished tab sessions without PII', () => {
  const request = (caseId, action, status, extra = {}) => ({
    event: status < 400 ? 'caseOpening.request.completed' : 'caseOpening.request.failed',
    time: 100,
    userId: 'synthetic-user',
    caseId,
    action,
    status,
    duration: 10,
    ...extra,
  });
  const visit = (caseId, action) => ({
    event: 'caseOpening.tab.visited',
    time: 100,
    userId: 'synthetic-user',
    caseId,
    action,
  });
  const result = summarizeOpening(
    [
      request('a', 'claim', 200),
      request('b', 'claim', 409),
      visit('a', 'qualification'),
      request('a', 'submit', 200, { totalScore: 75 }),
      visit('b', 'documents'),
      request('b', 'submit', 429),
    ],
    0,
  );
  assert.deepEqual(result.claim, { total: 2, success: 1, rate: 0.5 });
  assert.deepEqual(result.submit, { total: 2, success: 1, rate: 0.5 });
  assert.equal(result.averageScore, 75);
  assert.equal(result.dropOff.documents, 1);
  assert.equal(result.dropOff.qualification, 0);
  assert.equal(result.uniqueTabVisits.documents, 1);
  assert.equal(JSON.stringify(result).includes('synthetic-user'), false);
});
test('does not treat absent or out-of-window events as successful requests', () => {
  const result = summarizeOpening(
    [
      null,
      'invalid',
      { event: 'caseOpening.request.completed', action: 'claim', status: 200, time: 1 },
    ],
    2,
  );
  assert.equal(result.claim.rate, null);
  assert.equal(result.submit.rate, null);
  assert.equal(result.averageScore, null);
});
