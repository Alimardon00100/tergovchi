import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName } from 'pdf-lib';
import sharp from 'sharp';
import { CaseCrypto } from '../src/case-module/crypto';
import { sanitizeDocument } from '../src/case-module/documents.service';
const crypto = new CaseCrypto({
  secret: 'QA crypto test key long enough 2026',
  workspaceId: 'qa',
  controlToken: 'qa',
  shutdown: () => undefined,
});
describe('Case PII and document boundaries', () => {
  it('authenticates encrypted PII and randomizes equal values', () => {
    const a = crypto.encrypt('00000000001234'),
      b = crypto.encrypt('00000000001234');
    expect(a).not.toBe(b);
    expect(crypto.decrypt(a)).toBe('00000000001234');
    expect(() => crypto.decrypt('invalid')).toThrow();
    const parts = a.split('.');
    parts[2] = Buffer.alloc(16).toString('base64url');
    expect(() => crypto.decrypt(parts.join('.'))).toThrow();
  });
  it('binds signed links to document, case, actor, hash and expiry', () => {
    const claims = { documentId: 'document', caseId: 'case', userId: 'user', sha256: 'hash' },
      token = crypto.sign({ ...claims, expires: Date.now() + 5000 });
    expect(() => crypto.verify(token, claims)).not.toThrow();
    expect(() => crypto.verify(token, { ...claims, userId: 'other' })).toThrow();
    expect(() => crypto.verify(token + '.extra', claims)).toThrow();
    expect(() => crypto.verify('invalid', claims)).toThrow();
    expect(() => crypto.verify('x'.repeat(1600), claims)).toThrow();
    expect(() => crypto.verify(crypto.sign({ ...claims, expires: 0 }), claims)).toThrow();
  });
  it('rejects executable input, oversized input, and malformed or empty PDFs', async () => {
    await expect(sanitizeDocument(Buffer.from('<svg/>'), 'image/svg+xml')).rejects.toThrow();
    await expect(
      sanitizeDocument(Buffer.alloc(4 * 1024 * 1024 + 1), 'image/png'),
    ).rejects.toThrow();
    await expect(sanitizeDocument(Buffer.from('not a PDF'), 'application/pdf')).rejects.toThrow();
    const empty = await PDFDocument.create();
    await expect(
      sanitizeDocument(Buffer.from(await empty.save({ addDefaultPage: false })), 'application/pdf'),
    ).rejects.toThrow();
  });
  it('strips PDF actions and converts images to bounded WebP', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.catalog.set(PDFName.of('OpenAction'), doc.context.obj({ S: 'JavaScript', JS: 'alert(1)' }));
    const clean = await sanitizeDocument(Buffer.from(await doc.save()), 'application/pdf'),
      loaded = await PDFDocument.load(clean.data);
    expect(loaded.catalog.has(PDFName.of('OpenAction'))).toBe(false);
    const input = await sharp({
      create: { width: 100, height: 80, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();
    const image = await sanitizeDocument(input, 'image/png');
    expect(image.mime).toBe('image/webp');
    expect((await sharp(image.data).metadata()).format).toBe('webp');
  });
});
