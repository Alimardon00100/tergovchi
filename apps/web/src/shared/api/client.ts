import { z } from 'zod';
import { successEnvelope, errorEnvelopeSchema } from '@detective/shared';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
let refreshing: Promise<void> | null = null;
async function refresh() {
  if (!refreshing) {
    const run = async () => {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new ApiError('Sessiya tugagan. Qayta kiring.', 401);
    };
    refreshing = (
      navigator.locks ? navigator.locks.request('tergov-session-refresh', run) : run()
    ).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}
export async function api<T extends z.ZodType>(
  path: string,
  schema: T,
  options: RequestInit = {},
  retried = false,
): Promise<z.output<T>> {
  const headers = new Headers(options.headers);
  if (typeof options.body === 'string') headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch('/api' + path, { ...options, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError('Server bilan aloqa yo‘q. Ulanishni tekshiring.', 503);
  }
  if (
    response.status === 401 &&
    !retried &&
    !['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].includes(path)
  ) {
    await refresh();
    return api(path, schema, options, true);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorEnvelopeSchema.safeParse(body);
    throw new ApiError(
      parsed.success ? parsed.data.error.message : 'So‘rov bajarilmadi. Qayta urinib ko‘ring.',
      response.status,
    );
  }
  const envelope = successEnvelope(z.unknown()).parse(body);
  return schema.parse(envelope.data);
}
