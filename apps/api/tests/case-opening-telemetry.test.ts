import { afterEach, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import { openingLogger, registerOpeningTelemetry } from '../src/case-module/opening-telemetry';

afterEach(() => vi.restoreAllMocks());
it.each([200, 429, 500])(
  'logs final status %i even when a Nest guard did not run the interceptor',
  async (status) => {
    const app = fastify();
    const log = vi
      .spyOn(openingLogger, status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info')
      .mockImplementation(() => undefined);
    registerOpeningTelemetry(app);
    app.post('/api/v2/cases/:id/qualification/submit', async (_request, reply) =>
      reply.code(status).send({ success: status === 200 }),
    );
    app.get('/api/health', async () => ({ status: 'ok' }));
    try {
      await app.inject({
        method: 'POST',
        url: '/api/v2/cases/synthetic/qualification/submit?token=never-log-me',
        headers: { authorization: 'Bearer never-log-auth' },
      });
      expect(log).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'synthetic',
          userId: null,
          action: 'submit',
          status,
          duration: expect.any(Number),
        }),
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain('never-log');
      await app.inject('/api/health');
      expect(log).toHaveBeenCalledOnce();
    } finally {
      await app.close();
    }
  },
);
