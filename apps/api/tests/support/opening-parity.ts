import { expect } from 'vitest';
import { caseWorkspaceSchema } from '@detective/shared';
import { body } from './case-opening';
import type { Harness } from './case-opening';

export async function expectOpeningParity(h: Harness, id: string) {
  const v1 = caseWorkspaceSchema.parse(
    body(await h.request('user', 'GET', `/cases/${id}/workspace`)),
  );
  const v2 = caseWorkspaceSchema.parse(
    body(await h.request('user', 'GET', `/cases/${id}/workspace`, undefined, 'v2')),
  );
  expect({ ...v2, serverTime: '' }).toEqual({ ...v1, serverTime: '' });
  expect(body(await h.request('user', 'GET', '/meta', undefined, 'v2'))).toEqual(
    body(await h.request('user', 'GET', '/meta')),
  );
}
