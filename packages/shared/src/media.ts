import { z } from 'zod';
export const localMediaUrlSchema = z
  .string()
  .regex(/^\/api\/media\/(?:avatars|cases)\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/);
export const avatarUrlSchema = z.union([z.string().url(), localMediaUrlSchema]).nullable();
