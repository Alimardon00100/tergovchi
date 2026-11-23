import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function summarizeOpening(events, since = Date.now() - 7 * 86400000) {
  const claims = { total: 0, success: 0 },
    submits = { total: 0, success: 0 };
  const tabs = ['general', 'documents', 'persons', 'qualification', 'results'];
  const visits = Object.fromEntries(tabs.map((tab) => [tab, new Set()]));
  const sessions = new Map(),
    scores = [],
    durations = new Map();
  let serverErrors = 0;
  for (const event of events) {
    if (
      !event ||
      typeof event !== 'object' ||
      typeof event.time !== 'number' ||
      event.time < since ||
      typeof event.event !== 'string' ||
      !event.event.startsWith('caseOpening.')
    )
      continue;
    const key = String(event.caseId) + ':' + String(event.userId);
    if (event.event === 'caseOpening.tab.visited' && tabs.includes(event.action)) {
      visits[event.action].add(key);
      sessions.set(key, { ...sessions.get(key), lastTab: event.action });
    }
    if (!['caseOpening.request.completed', 'caseOpening.request.failed'].includes(event.event))
      continue;
    if (typeof event.status !== 'number') continue;
    const success = event.status < 400;
    if (event.action === 'claim' || event.action === 'submit') {
      const metric = event.action === 'claim' ? claims : submits;
      metric.total++;
      if (success) metric.success++;
    }
    if (event.action === 'submit' && success)
      sessions.set(key, { ...sessions.get(key), submitted: true });
    if (success && typeof event.totalScore === 'number' && Number.isFinite(event.totalScore))
      scores.push(event.totalScore);
    if (
      typeof event.action === 'string' &&
      typeof event.duration === 'number' &&
      event.duration >= 0
    ) {
      if (!durations.has(event.action)) durations.set(event.action, []);
      durations.get(event.action).push(event.duration);
    }
    if (event.status >= 500) serverErrors++;
  }
  const dropOff = Object.fromEntries(tabs.map((tab) => [tab, 0]));
  for (const session of sessions.values())
    if (!session.submitted && session.lastTab) dropOff[session.lastTab]++;
  const rate = (metric) => ({
    ...metric,
    rate: metric.total ? metric.success / metric.total : null,
  });
  return {
    claim: rate(claims),
    submit: rate(submits),
    averageScore: scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null,
    uniqueTabVisits: Object.fromEntries(tabs.map((tab) => [tab, visits[tab].size])),
    dropOff,
    p95Ms: Object.fromEntries(
      [...durations].map(([action, samples]) => [
        action,
        samples.sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1],
      ]),
    ),
    alerts: {
      serverErrors,
      submitFailureRateHigh: submits.total >= 10 && submits.success / submits.total < 0.95,
    },
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const lines = createInterface({
      input: createReadStream(process.argv[2] ?? '.local/http.log'),
      crlfDelay: Infinity,
    });
    const events = [];
    for await (const line of lines) {
      if (!line.startsWith('{')) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        /* Non-JSON launcher output is ignored. */
      }
    }
    const result = summarizeOpening(events);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.alerts.serverErrors > 0 || result.alerts.submitFailureRateHigh) process.exitCode = 2;
  } catch {
    process.stderr.write('Logni o‘qib bo‘lmadi. Fayl manzilini tekshiring.\n');
    process.exitCode = 1;
  }
}
