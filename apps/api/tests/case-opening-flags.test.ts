import { afterEach, describe, expect, it, vi } from 'vitest';
import { caseOpeningV2Enabled } from '../src/case-module/flags';

afterEach(() => vi.unstubAllEnvs());
describe('Case opening runtime rollout', () => {
  it('defaults off and requires an explicit true', () => {
    vi.stubEnv('FF_CASE_OPENING_V2', '');
    expect(caseOpeningV2Enabled('user')).toBe(false);
    vi.stubEnv('FF_CASE_OPENING_V2', 'false');
    expect(caseOpeningV2Enabled('user')).toBe(false);
  });
  it('supports a stable cohort, full rollout and immediate rollback', () => {
    vi.stubEnv('FF_CASE_OPENING_V2', 'true');
    vi.stubEnv('FF_CASE_OPENING_V2_PERCENTAGE', '10');
    const users = Array.from({ length: 1000 }, (_, i) => String(i));
    const cohort = users.filter(caseOpeningV2Enabled);
    expect(cohort).toEqual(users.filter(caseOpeningV2Enabled));
    expect(cohort.length).toBeGreaterThan(50);
    expect(cohort.length).toBeLessThan(150);
    vi.stubEnv('FF_CASE_OPENING_V2_PERCENTAGE', '100');
    expect(users.every(caseOpeningV2Enabled)).toBe(true);
    vi.stubEnv('FF_CASE_OPENING_V2', 'false');
    expect(users.some(caseOpeningV2Enabled)).toBe(false);
  });
  it.each(['invalid', '-1', '101', 'Infinity', '0'])('fails closed for percentage %s', (value) => {
    vi.stubEnv('FF_CASE_OPENING_V2', 'true');
    vi.stubEnv('FF_CASE_OPENING_V2_PERCENTAGE', value);
    expect(caseOpeningV2Enabled('user')).toBe(false);
  });
});
