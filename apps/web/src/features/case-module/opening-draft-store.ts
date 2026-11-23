import { z } from 'zod';
import { LEGAL_ELEMENTS } from '@detective/shared';

export const openingLocalSchema = z.object({
  expires: z.number(),
  answers: z.array(
    z.object({
      episodeId: z.string().uuid(),
      element: z.enum(LEGAL_ELEMENTS),
      payload: z.unknown(),
      version: z.number().int().min(0),
      dirty: z.boolean(),
    }),
  ),
});
export type OpeningRow = z.infer<typeof openingLocalSchema>['answers'][number];
export const answerKey = (row: Pick<OpeningRow, 'episodeId' | 'element'>) =>
  row.episodeId + ':' + row.element;
export function persistOpening(key: string, rows: OpeningRow[]) {
  if (rows.some((row) => row.dirty))
    localStorage.setItem(key, JSON.stringify({ expires: Date.now() + 86400000, answers: rows }));
  else localStorage.removeItem(key);
}
