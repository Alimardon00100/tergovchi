import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import {
  assertReachable,
  assertSupportedNode,
  getServiceTargets,
} from '../scripts/local-runtime.mjs';

test('Qo‘llanadigan Node versiyalarini tekshiradi', () => {
  for (const version of ['v22.13.0', '22.22.0', '24.1.0', '26.7.0'])
    assert.doesNotThrow(() => assertSupportedNode(version));
  for (const version of ['18.20.0', '22.12.0', '23.0.0', '25.0.0', 'invalid'])
    assert.throws(() => assertSupportedNode(version));
});

test('Mahalliy xizmatlarning odatiy va sozlangan portlarini o‘qiydi', () => {
  const targets = getServiceTargets({
    DATABASE_URL: 'postgresql://agent:private@127.0.0.1:15432/cases',
    REDIS_URL: 'rediss://cache.example.test:6380',
  });
  assert.deepEqual(targets, [
    { name: 'PostgreSQL', host: '127.0.0.1', port: 15432 },
    { name: 'Redis', host: 'cache.example.test', port: 6380 },
  ]);
  assert.equal(
    getServiceTargets({
      DATABASE_URL: 'postgres://localhost/cases',
      REDIS_URL: 'redis://localhost',
    })[0].port,
    5432,
  );
});

test('IPv6 hostidagi qavslarni socket manzilidan chiqaradi', () => {
  const targets = getServiceTargets({
    DATABASE_URL: 'postgresql://[::1]/cases',
    REDIS_URL: 'redis://[::1]',
  });
  assert.equal(targets[0].host, '::1');
});

test('Yaroqsiz manzil xatosida maxfiy qiymatlarni chiqarmaydi', () => {
  const secret = 'do-not-print-this-password';
  assert.throws(
    () =>
      getServiceTargets({
        DATABASE_URL: `http://agent:${secret}@localhost/cases`,
        REDIS_URL: 'redis://localhost',
      }),
    (error) => !error.message.includes(secret) && error.message.includes('PostgreSQL'),
  );
});

test('Yetishmayotgan URL, parol shabloni va baza nomini rad etadi', () => {
  for (const url of [
    undefined,
    'not-a-url',
    'postgresql://agent:CHANGE_ME@localhost/cases',
    'postgresql://localhost/',
  ]) {
    assert.throws(() => getServiceTargets({ DATABASE_URL: url, REDIS_URL: 'redis://localhost' }));
  }
});

test('Ishlayotgan TCP xizmatini aniqlaydi va socketni yopadi', async () => {
  const server = createServer((socket) => socket.end());
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    await assertReachable({ name: 'Sinov xizmati', host: '127.0.0.1', port: address.port });
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('Xizmat ishlamasa tushunarli xato qaytaradi', async () => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  server.close();
  await once(server, 'close');
  await assert.rejects(
    assertReachable({ name: 'PostgreSQL', host: '127.0.0.1', port: address.port }),
    /PostgreSQL bilan ulanish yo‘q/,
  );
});
