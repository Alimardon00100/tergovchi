import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useManagedServices, toCygwinPath, serviceUrls } from '../scripts/managed-config.mjs';
import {
  assertSafeArchiveEntry,
  verifyRedisArchive,
  REDIS_ASSET,
} from '../scripts/portable-assets.mjs';

test('Eski mahalliy shablonni taniydi; tashqi xizmat sozlamasini saqlaydi', () => {
  assert.equal(
    useManagedServices({ DATABASE_URL: 'postgresql://agent:secret@127.0.0.1:15432/detective' }),
    true,
  );
  assert.equal(
    useManagedServices({ DATABASE_URL: 'postgresql://agent:secret@db.example.test/detective' }),
    false,
  );
  assert.equal(
    useManagedServices({
      LOCAL_SERVICES: 'external',
      DATABASE_URL: 'postgresql://localhost:15432/detective',
    }),
    false,
  );
  assert.equal(useManagedServices({ LOCAL_SERVICES: 'managed' }), true);
});

test('Xizmatlar uchun alohida bazalar va URL-encoded parol hosil qiladi', () => {
  const values = serviceUrls({
    user: 'detective',
    password: 'a@b:c',
    postgresPort: 15432,
    redisPort: 16379,
    redisPassword: 'secret@cache',
  });
  assert.equal(new URL(values.DATABASE_URL).pathname, '/detective');
  assert.equal(new URL(values.TEST_DATABASE_URL).pathname, '/detective_test');
  assert.equal(decodeURIComponent(new URL(values.DATABASE_URL).password), 'a@b:c');
  assert.equal(decodeURIComponent(new URL(values.REDIS_URL).password), 'secret@cache');
});

test('Windows yo‘llarini bo‘sh joylarni saqlab Cygwin formatiga o‘tkazadi', () => {
  assert.equal(toCygwinPath('D:\\My Project\\data'), '/cygdrive/d/My Project/data');
  assert.throws(() => toCygwinPath('../data'));
});

test('Arxivdan tashqariga yozadigan yo‘llarni rad etadi', () => {
  for (const entry of [
    '../escape.exe',
    'folder/../../escape',
    '/absolute/file',
    'C:\\absolute.exe',
  ])
    assert.throws(() => assertSafeArchiveEntry(entry));
  assert.doesNotThrow(() => assertSafeArchiveEntry('Redis/bin/redis-server.exe'));
});

test('Buzilgan yoki almashtirilgan Redis paketini ishga tushirmaydi', () => {
  assert.equal(verifyRedisArchive(Buffer.from('not-a-redis-archive')), false);
  assert.equal(verifyRedisArchive(Buffer.alloc(REDIS_ASSET.bytes)), false);
  assert.equal(REDIS_ASSET.sha256.length, 64);
});
