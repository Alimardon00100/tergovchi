import { ELEMENT_WEIGHTS, LEGAL_ELEMENTS, completeSchemas } from '@detective/shared';
import type { LegalElement, PayloadMap } from '@detective/shared';
export type Answers = { episodeId: string; elementType: LegalElement; payload: unknown }[];
export type ScoringEpisode = { id: string; episodeNumber: number; weight: number };
export function setF1(reference: readonly string[], answer: readonly string[]): number {
  const ref = new Set(reference),
    ans = new Set(answer);
  if (ref.size + ans.size === 0) return 1;
  let matches = 0;
  for (const item of ans) if (ref.has(item)) matches++;
  return (2 * matches) / (ref.size + ans.size);
}
const pairs = (rows: PayloadMap['SUBJECT']) => rows.map((row) => `${row.personId}:${row.role}`);
const scalar = (ref: string, ans: string) => setF1([ref], [ans]);
export function scoreElement(element: LegalElement, reference: unknown, answer: unknown) {
  const ref = completeSchemas[element].parse(reference),
    ans = completeSchemas[element].parse(answer);
  let fields: { field: string; f1: number }[];
  switch (element) {
    case 'SUBJECT':
    case 'PARTICIPATION':
      fields = [
        {
          field: 'personRolePairs',
          f1: setF1(pairs(ref as PayloadMap['SUBJECT']), pairs(ans as PayloadMap['SUBJECT'])),
        },
      ];
      break;
    case 'OBJECT':
      fields = [{ field: 'objects', f1: setF1(ref as string[], ans as string[]) }];
      break;
    case 'OBJECTIVE': {
      const r = ref as PayloadMap['OBJECTIVE'],
        a = ans as PayloadMap['OBJECTIVE'];
      fields = [
        { field: 'action', f1: scalar(r.action, a.action) },
        { field: 'consequences', f1: setF1(r.consequences, a.consequences) },
        { field: 'causality', f1: scalar(r.causality, a.causality) },
      ];
      break;
    }
    case 'SUBJECTIVE': {
      const r = ref as PayloadMap['SUBJECTIVE'],
        a = ans as PayloadMap['SUBJECTIVE'];
      fields = [
        { field: 'guilt', f1: scalar(r.guilt, a.guilt) },
        { field: 'motive', f1: scalar(r.motive, a.motive) },
        { field: 'purpose', f1: scalar(r.purpose, a.purpose) },
      ];
      // Applicability is fixed by the reference, never by a candidate's answer.
      if (r.guilt === 'QASDDAN') fields.push({ field: 'intent', f1: scalar(r.intent, a.intent) });
      break;
    }
  }
  const f1 = fields.reduce((sum, item) => sum + item.f1, 0) / fields.length;
  return {
    element,
    points: f1 * ELEMENT_WEIGHTS[element],
    max: ELEMENT_WEIGHTS[element],
    f1,
    fields,
  };
}
export function scoreQualification(
  episodes: ScoringEpisode[],
  reference: Answers,
  answers: Answers,
) {
  if (episodes.length === 0 || episodes.some((e) => !Number.isFinite(e.weight) || e.weight <= 0))
    throw Error('Invalid episode weights');
  const index = (rows: Answers) => {
    const map = new Map<string, unknown>();
    for (const row of rows) {
      const key = `${row.episodeId}:${row.elementType}`;
      if (map.has(key)) throw Error('Duplicate element');
      map.set(key, row.payload);
    }
    return map;
  };
  const refs = index(reference),
    ans = index(answers);
  const breakdown = episodes.map((episode) => {
    const elements = LEGAL_ELEMENTS.map((element) => {
      const key = `${episode.id}:${element}`;
      if (!refs.has(key)) throw Error('Reference missing');
      if (!ans.has(key)) throw Error('Answer missing');
      return scoreElement(element, refs.get(key), ans.get(key));
    });
    return {
      episodeId: episode.id,
      episodeNumber: episode.episodeNumber,
      weight: episode.weight,
      score: elements.reduce((sum, item) => sum + item.points, 0),
      elements,
    };
  });
  const total =
    breakdown.reduce((sum, e) => sum + e.score * e.weight, 0) /
    episodes.reduce((sum, e) => sum + e.weight, 0);
  return { episodes: breakdown, total: Math.round((total + Number.EPSILON) * 100) / 100 };
}
