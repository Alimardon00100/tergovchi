import { difficultySchema } from './contracts';
import type { Difficulty } from './contracts';
import { pointsSchema } from './ranks';

export const BASE_POINTS: Readonly<Record<Difficulty, number>> = { EASY: 20, MEDIUM: 30, HARD: 50 };

export function resolveCasePoints(difficulty: Difficulty, customPoints: number | null): number {
  difficultySchema.parse(difficulty);
  // DECISION: nol ham haqiqiy override; truthy tekshiruvi emas, nullish tanlash ishlatiladi.
  return pointsSchema.parse(customPoints ?? BASE_POINTS[difficulty]);
}
