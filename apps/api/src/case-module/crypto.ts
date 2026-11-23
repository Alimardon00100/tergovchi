import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { HTTP_OPTIONS } from '../http/controllers';
import type { HttpOptions } from '../http/controllers';
@Injectable()
export class CaseCrypto {
  private readonly key: Buffer;
  private readonly signing: Buffer;
  constructor(@Inject(HTTP_OPTIONS) options: HttpOptions) {
    this.key = createHash('sha256')
      .update('case-pii-v1:' + options.secret)
      .digest();
    this.signing = createHash('sha256')
      .update('case-document-v1:' + options.secret)
      .digest();
  }
  encrypt(value: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      data.toString('base64url'),
    ].join('.');
  }
  decrypt(value: string) {
    const [version, iv, tag, data] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !data) throw Error('Invalid encrypted record');
    const cipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    cipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([cipher.update(Buffer.from(data, 'base64url')), cipher.final()]).toString(
      'utf8',
    );
  }
  sign(claims: {
    documentId: string;
    caseId: string;
    userId: string;
    sha256: string;
    expires: number;
  }) {
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return body + '.' + createHmac('sha256', this.signing).update(body).digest('base64url');
  }
  verify(
    token: string,
    expected: { documentId: string; caseId: string; userId: string; sha256: string },
  ) {
    if (token.length > 1500) throw new ForbiddenException('Hujjat havolasi yaroqsiz.');
    const [body, signature, ...extra] = token.split('.');
    if (!body || !signature || extra.length)
      throw new ForbiddenException('Hujjat havolasi yaroqsiz.');
    const calculated = createHmac('sha256', this.signing).update(body).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== calculated.length || !timingSafeEqual(actual, calculated))
      throw new ForbiddenException('Hujjat havolasi yaroqsiz.');
    let claims: Record<string, unknown>;
    try {
      claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >;
    } catch {
      throw new ForbiddenException('Hujjat havolasi yaroqsiz.');
    }
    if (
      typeof claims['expires'] !== 'number' ||
      claims['expires'] <= Date.now() ||
      Object.entries(expected).some(([key, value]) => claims[key] !== value)
    )
      throw new ForbiddenException('Hujjat havolasining muddati tugagan.');
  }
}
