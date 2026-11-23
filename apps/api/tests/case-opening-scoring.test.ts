import { describe, expect, it } from 'vitest';
import { completeSchemas, ELEMENT_WEIGHTS } from '@detective/shared';
import { scoreElement, setF1 } from '../src/case-module/scoring';

const subjective = {
  guilt: 'QASDDAN',
  intent: 'TOGRI',
  motive: 'GREED',
  motiveNote: '',
  purpose: 'ENRICHMENT',
  purposeNote: '',
};
describe('User-confirmed scoring contract', () => {
  it('retains the exact 100-point independent element budget', () => {
    expect(Object.values(ELEMENT_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
    expect(ELEMENT_WEIGHTS.SUBJECT).toBe(50);
    expect(Object.values(ELEMENT_WEIGHTS).slice(1)).toEqual([12.5, 12.5, 12.5, 12.5]);
  });
  it.each(['guilt', 'intent', 'motive', 'purpose'] as const)(
    'keeps equal subjective credit when %s is wrong',
    (field) => {
      const changes = {
        guilt: { guilt: 'EHTIYOTSIZLIKDAN', intent: '' },
        intent: { intent: 'EGRI' },
        motive: { motive: 'REVENGE' },
        purpose: { purpose: 'HARM' },
      };
      const score = scoreElement('SUBJECTIVE', subjective, { ...subjective, ...changes[field] });
      expect(score.fields).toHaveLength(4);
      expect(score.points).toBe(field === 'guilt' ? 6.25 : 9.375);
    },
  );
  it('rejects missing conditional intent before scoring and keeps notes unscored', () => {
    expect(completeSchemas.SUBJECTIVE.safeParse({ ...subjective, intent: '' }).success).toBe(false);
    expect(
      scoreElement('SUBJECTIVE', subjective, {
        ...subjective,
        motiveNote: 'Different',
        purposeNote: 'Different',
      }).points,
    ).toBe(12.5);
  });
  it('keeps F1 symmetric, bounded and set-based across partial/extra selections', () => {
    for (const reference of [[], ['a'], ['a', 'b'], ['a', 'a', 'b']])
      for (const answer of [[], ['b'], ['a', 'b', 'c'], ['a', 'a']]) {
        expect(setF1(reference, answer)).toBe(setF1(answer, reference));
        expect(setF1(reference, answer)).toBeGreaterThanOrEqual(0);
        expect(setF1(reference, answer)).toBeLessThanOrEqual(1);
      }
  });
});
