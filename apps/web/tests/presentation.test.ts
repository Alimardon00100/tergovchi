import { describe, expect, it } from 'vitest';
import { formatDate } from '../src/shared/lib/presentation';
describe('O‘zbekcha sanalar', () => {
  it('Toshkent kun chegarasini hisoblaydi', () => {
    expect(formatDate('2026-11-21T20:00:00Z')).toBe('22-noyabr 2026-yil');
  });
  it('grafik uchun qisqa va locale ma’lumotiga bog‘liq bo‘lmagan oy beradi', () => {
    expect(formatDate('2026-01-01T12:00:00Z', true)).toBe('1 yan');
  });
});
