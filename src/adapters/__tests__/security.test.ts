import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import {
  InvalidTokenError,
} from '../../domain/users.js';
import { JwtTokenService, ScryptPasswordHasher } from '../security.js';

describe('ScryptPasswordHasher', () => {
  it('propagates password-hashing failures', async () => {
    const hasher: ScryptPasswordHasher = new ScryptPasswordHasher(
      (_password, _salt, _keyLength, _options, callback) => {
        callback(new Error('scrypt unavailable'), Buffer.alloc(0));
      },
    );

    await expect(hasher.hash('password')).rejects.toThrow(
      'scrypt unavailable',
    );
  });

  it('hashes a password and verifies it', async () => {
    const hasher: ScryptPasswordHasher = new ScryptPasswordHasher();
    const hash: string = await hasher.hash('correct horse battery staple');

    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    await expect(
      hasher.verify('correct horse battery staple', hash),
    ).resolves.toBe(true);
    await expect(hasher.verify('incorrect password', hash)).resolves.toBe(false);
  });

  it.each([
    '',
    'scrypt$1$8$1$0123456789abcdef0123456789abcdef$' + 'a'.repeat(128),
    'scrypt$16384$1$1$0123456789abcdef0123456789abcdef$' + 'a'.repeat(128),
    'scrypt$16384$8$2$0123456789abcdef0123456789abcdef$' + 'a'.repeat(128),
    'scrypt$16384$8$1$short$' + 'a'.repeat(128),
    'scrypt$16384$8$1$0123456789abcdef0123456789abcdef$short',
    'wrong$16384$8$1$0123456789abcdef0123456789abcdef$' + 'a'.repeat(128),
    'scrypt$16384$8$1',
  ])('rejects malformed password hash %s', async (hash) => {
    await expect(
      new ScryptPasswordHasher().verify('password', hash),
    ).resolves.toBe(false);
  });
});

describe('JwtTokenService', () => {
  const secret: string = 'a-secret-with-at-least-thirty-two-bytes-long';

  it('requires a secret of at least 32 bytes', () => {
    expect(() => new JwtTokenService('too-short')).toThrow(
      'JWT_SECRET must contain at least 32 bytes.',
    );
  });

  it('issues a 15-minute HS256 token with an audience, issuer, and subject', () => {
    const service: JwtTokenService = new JwtTokenService(secret);
    const token: string = service.issue('user-123');
    const payload: string | JwtPayload | null = jwt.decode(token);

    expect(payload).toMatchObject({
      sub: 'user-123',
      aud: 'og-lab-api',
      iss: 'og-lab-be',
    });
    expect(typeof payload).not.toBe('string');
    if (
      payload !== null &&
      typeof payload !== 'string' &&
      typeof payload['exp'] === 'number' &&
      typeof payload['iat'] === 'number'
    ) {
      expect(payload['exp'] - payload['iat']).toBe(900);
    }
    expect(service.verify(token)).toBe('user-123');
  });

  it.each(['not-a-token', jwt.sign({ sub: 'user-123' }, secret)])(
    'rejects malformed or incorrectly scoped tokens',
    (token) => {
      expect(() => new JwtTokenService(secret).verify(token)).toThrow(
        InvalidTokenError,
      );
    },
  );

  it('rejects a token without a subject', () => {
    const token: string = jwt.sign({}, secret, {
      audience: 'og-lab-api',
      issuer: 'og-lab-be',
    });

    expect(() => new JwtTokenService(secret).verify(token)).toThrow(
      InvalidTokenError,
    );
  });

  it('rejects a JWT with a string payload', () => {
    const token: string = jwt.sign('a-string-payload', secret);

    expect(() => new JwtTokenService(secret).verify(token)).toThrow(
      InvalidTokenError,
    );
  });

  it('propagates unexpected verification errors', () => {
    const verify: jest.SpyInstance = jest
      .spyOn(jwt, 'verify')
      .mockImplementationOnce(() => {
        throw new Error('unexpected failure');
      });

    expect(() => new JwtTokenService(secret).verify('token')).toThrow(
      'unexpected failure',
    );
    verify.mockRestore();
  });
});
