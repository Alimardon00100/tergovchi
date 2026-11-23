import { z } from 'zod';
import { documentViewSchema, personCreateSchema, personViewSchema } from './contracts';
import { draftWriteSchema, elementSchema } from './qualification';

export const caseOpeningConfigSchema = z.object({ enabled: z.boolean() }).strict();
export const personCreateV2Schema = personCreateSchema.extend({
  contact: z.string().trim().max(500).nullable().default(null),
  note: z.string().trim().max(2000).nullable().default(null),
});
export const personV2Schema = personViewSchema.extend({
  contact: z.string().nullable(),
  note: z.string().nullable(),
});
export const personsV2Schema = z.array(personV2Schema);
export const documentsV2Schema = z.array(
  documentViewSchema.extend({
    signedUrl: z.string().startsWith('/api/v2/cases/'),
  }),
);
export const answerWriteV2Schema = draftWriteSchema.extend({ elementType: elementSchema });
export const caseOpeningEventSchema = z
  .object({
    caseId: z.string().uuid(),
    tab: z.enum(['general', 'documents', 'persons', 'qualification', 'results']),
  })
  .strict();
export type PersonV2 = z.infer<typeof personV2Schema>;
export type PersonCreateV2 = z.infer<typeof personCreateV2Schema>;
