import { createHmac } from 'node:crypto';
import { ThumborImageUrl } from '../thumbor-image-url.js';

describe('ThumborImageUrl', () => {
  it('requires a strong Thumbor signing key', () => {
    expect(
      () =>
        new ThumborImageUrl(
          'https://thumbor.example',
          'https://images.example.com',
          'short',
        ),
    ).toThrow('THUMBOR_SECURITY_KEY must contain at least 32 bytes.');
  });

  it('creates a signed WebP transformation URL for the R2 object', () => {
    const securityKey = 'a-thumbor-secret-with-at-least-thirty-two-bytes';
    const generator = new ThumborImageUrl(
      'https://thumbor.example/',
      'https://images.example.com/',
      securityKey,
    );

    const url = generator.create('profiles/user 1/avatar.webp');
    const source =
      'https://images.example.com/profiles/user%201/avatar.webp';
    const path = `0x0/filters:format(webp):quality(80)/${source}`;
    const signature = createHmac('sha1', securityKey)
      .update(path)
      .digest('base64url');

    expect(url).toBe(`https://thumbor.example/${signature}/${path}`);
  });
});
