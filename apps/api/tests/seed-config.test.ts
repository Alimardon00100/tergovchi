import { describe, expect, it } from 'vitest';
import { seedEnvironmentSchema } from '../src/infra/seed-config';

describe('Seed muhiti', () => {
  const environment = {
    DATABASE_URL: 'postgresql://detective:secret@localhost:5432/detective',
    SEED_ADMIN_EMAIL: 'ADMIN@EXAMPLE.TEST',
    SEED_ADMIN_PASSWORD: 'long unique passphrase 2026',
  };
  it('adminni faqat aniq berilgan ma’lumotlardan yaratadi', () => {
    expect(seedEnvironmentSchema.parse(environment).SEED_ADMIN_EMAIL).toBe('admin@example.test');
    expect(
      seedEnvironmentSchema.safeParse({ DATABASE_URL: environment.DATABASE_URL }).success,
    ).toBe(false);
  });
  it('boshqa DB protokoli va qisqa parolni rad etadi', () => {
    expect(
      seedEnvironmentSchema.safeParse({ ...environment, DATABASE_URL: 'https://example.test' })
        .success,
    ).toBe(false);
    expect(
      seedEnvironmentSchema.safeParse({ ...environment, SEED_ADMIN_PASSWORD: 'admin' }).success,
    ).toBe(false);
  });
});
