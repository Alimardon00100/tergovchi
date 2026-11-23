import { describe, it, expect } from 'vitest';
import { LEGAL_ELEMENTS, emptyPayloads } from '@detective/shared';
import { setF1, scoreElement, scoreQualification } from '../src/case-module/scoring';
const ids = [
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000013',
] as const;
const tuple = (id: string) => ({ personId: id, role: 'IJROCHI' as const });
const payloads = () => ({
  ...emptyPayloads(),
  SUBJECT: [tuple(ids[0])],
  OBJECT: ['PROPERTY' as const],
  OBJECTIVE: {
    action: 'HARAKAT' as const,
    consequences: ['MATERIAL' as const],
    causality: 'MAVJUD' as const,
    note: '',
  },
  SUBJECTIVE: {
    guilt: 'QASDDAN' as const,
    intent: 'TOGRI' as const,
    motive: 'GREED' as const,
    motiveNote: '',
    purpose: 'ENRICHMENT' as const,
    purposeNote: '',
  },
});
const rows = (episodeId: string, p = payloads()) =>
  LEGAL_ELEMENTS.map((elementType) => ({ episodeId, elementType, payload: p[elementType] }));
describe('Case qualification scoring', () => {
  it('handles empty sets, order and duplicate selections', () => {
    expect(setF1([], [])).toBe(1);
    expect(setF1(['a'], [])).toBe(0);
    expect(setF1([], ['a'])).toBe(0);
    expect(setF1(['a', 'b'], ['b', 'a', 'a'])).toBe(1);
  });
  it('awards 50 for exact subject pairs and 40 for 2 of 3', () => {
    const ref = ids.map(tuple);
    expect(scoreElement('SUBJECT', ref, ref).points).toBe(50);
    expect(scoreElement('SUBJECT', ref, ref.slice(0, 2)).points).toBe(40);
  });
  it('treats a wrong role as a wrong pair', () => {
    expect(
      scoreElement('SUBJECT', [tuple(ids[0])], [{ personId: ids[0], role: 'YORDAMCHI' }]).points,
    ).toBe(0);
  });
  it('deduplicates participation and permits an empty set', () => {
    const ref = [tuple(ids[0])];
    expect(scoreElement('PARTICIPATION', ref, [...ref, ...ref]).points).toBe(12.5);
    expect(scoreElement('PARTICIPATION', [], []).points).toBe(12.5);
  });
  it('scores other elements independently of subjects', () => {
    const p = payloads();
    p.SUBJECT = [tuple(ids[1])];
    expect(
      scoreQualification(
        [{ id: ids[2], episodeNumber: 1, weight: 1 }],
        rows(ids[2]),
        rows(ids[2], p),
      ).total,
    ).toBe(50);
  });
  it('gives equal credit to the three objective fields and ignores notes', () => {
    const r = payloads().OBJECTIVE;
    expect(
      scoreElement('OBJECTIVE', r, { ...r, action: 'HARAKATSIZLIK', note: 'Different note' })
        .points,
    ).toBeCloseTo((12.5 * 2) / 3);
  });
  it('has four subjective fields for intentional reference and three otherwise', () => {
    const r = payloads().SUBJECTIVE;
    expect(scoreElement('SUBJECTIVE', r, { ...r, intent: 'EGRI' }).points).toBe(9.375);
    const n = { ...r, guilt: 'EHTIYOTSIZLIKDAN', intent: '' };
    expect(scoreElement('SUBJECTIVE', n, n).fields).toHaveLength(3);
    expect(scoreElement('SUBJECTIVE', r, n).points).toBe(6.25);
  });
  it('computes weighted episodes and rounds only the final result', () => {
    const e = [
      { id: ids[1], episodeNumber: 1, weight: 1 },
      { id: ids[2], episodeNumber: 2, weight: 3 },
    ];
    const wrong = payloads();
    wrong.SUBJECT = [tuple(ids[2])];
    expect(
      scoreQualification(
        e,
        [...rows(ids[1]), ...rows(ids[2])],
        [...rows(ids[1]), ...rows(ids[2], wrong)],
      ).total,
    ).toBe(62.5);
  });
  it('rejects absent references, invalid weights, incomplete and duplicate elements', () => {
    const e = [{ id: ids[2], episodeNumber: 1, weight: 1 }],
      r = rows(ids[2]);
    expect(() => scoreQualification(e, [], r)).toThrow('Reference missing');
    expect(() => scoreQualification([], r, r)).toThrow();
    expect(() =>
      scoreQualification([{ ...(e[0] as (typeof e)[number]), weight: 0 }], r, r),
    ).toThrow();
    expect(() => scoreQualification(e, r, [])).toThrow('Answer missing');
    expect(() => scoreQualification(e, [...r, r[0] as (typeof r)[number]], r)).toThrow(
      'Duplicate element',
    );
    expect(() => scoreElement('SUBJECT', [], [])).toThrow();
  });
});
