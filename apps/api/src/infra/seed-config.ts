import { z } from 'zod';
import { emailSchema, passwordSchema } from '@detective/shared';

export const seedEnvironmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((url) => /^postgres(?:ql)?:\/\//.test(url), 'PostgreSQL manzili kerak.'),
  SEED_ADMIN_EMAIL: emailSchema,
  SEED_ADMIN_PASSWORD: passwordSchema,
  SEED_ADMIN_NAME: z.string().trim().min(2).max(80).default('Bosh tergovchi'),
});

export type SeedEnvironment = z.infer<typeof seedEnvironmentSchema>;
