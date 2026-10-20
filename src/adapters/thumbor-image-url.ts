import { createHmac } from 'node:crypto';
import type { ImageUrlGenerator } from '../domain/users.js';

export class ThumborImageUrl implements ImageUrlGenerator {
  public constructor(
    private readonly thumborBaseUrl: string,
    private readonly r2PublicBaseUrl: string,
    private readonly securityKey: string,
  ) {
    if (Buffer.byteLength(securityKey, 'utf8') < 32) {
      throw new Error('THUMBOR_SECURITY_KEY must contain at least 32 bytes.');
    }
  }

  public create(key: string): string {
    const encodedKey: string = key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const sourceUrl: string = new URL(
      encodedKey,
      `${this.r2PublicBaseUrl.replace(/\/+$/, '')}/`,
    ).toString();
    const path: string = `0x0/filters:format(webp):quality(80)/${sourceUrl}`;
    const signature: string = createHmac('sha1', this.securityKey)
      .update(path)
      .digest('base64url');

    return `${this.thumborBaseUrl.replace(/\/+$/, '')}/${signature}/${path}`;
  }
}
