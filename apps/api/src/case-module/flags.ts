import { createHash } from 'node:crypto';

export function caseOpeningV2Enabled(userId: string): boolean {
  if (process.env['FF_CASE_OPENING_V2'] !== 'true') return false;
  const percentage = Number(process.env['FF_CASE_OPENING_V2_PERCENTAGE'] ?? '100');
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) return false;
  const bucket =
    createHash('sha256')
      .update('case-opening-v2:' + userId)
      .digest()
      .readUInt32BE(0) % 100;
  return bucket < percentage;
}

export const CASE_OPENING_LIMITS = {
  lockMs: 24 * 60 * 60 * 1000,
  signedUrlMs: 15 * 60 * 1000,
  autosaveMs: 2000,
  attempts: 3,
  submitPerMinute: 3,
} as const;
