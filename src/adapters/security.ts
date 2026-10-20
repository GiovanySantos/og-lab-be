import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt, { JsonWebTokenError } from 'jsonwebtoken';
import { InvalidTokenError, type PasswordHasher, type TokenService } from '../domain/users.js';

const saltBytes = 16;
const derivedKeyBytes = 64;
type ScryptRunner = (
  password: string,
  salt: string,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
  callback: (error: Error | null, key: Buffer) => void,
) => void;

export class ScryptPasswordHasher implements PasswordHasher {
  public constructor(private readonly runScrypt: ScryptRunner = scrypt) {}

  public async hash(password: string): Promise<string> {
    const salt = randomBytes(saltBytes).toString('hex');
    const derivedKey = await deriveKey(password, salt, this.runScrypt);

    return `scrypt$16384$8$1$${salt}$${derivedKey.toString('hex')}`;
  }

  public async verify(password: string, encodedHash: string): Promise<boolean> {
    const [algorithm, cost, blockSize, parallelization, salt, encodedKey] =
      encodedHash.split('$');

    if (
      algorithm !== 'scrypt' ||
      cost !== '16384' ||
      blockSize !== '8' ||
      parallelization !== '1' ||
      salt === undefined ||
      encodedKey === undefined ||
      !/^[a-f0-9]{32}$/.test(salt) ||
      !/^[a-f0-9]{128}$/.test(encodedKey)
    ) {
      return false;
    }

    const expected = Buffer.from(encodedKey, 'hex');
    const actual = await deriveKey(password, salt, this.runScrypt);
    return timingSafeEqual(actual, expected);
  }
}

export class JwtTokenService implements TokenService {
  public constructor(private readonly secret: string) {
    if (Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error('JWT_SECRET must contain at least 32 bytes.');
    }
  }

  public issue(userId: string): string {
    return jwt.sign({}, this.secret, {
      algorithm: 'HS256',
      audience: 'og-lab-api',
      expiresIn: '15m',
      issuer: 'og-lab-be',
      subject: userId,
    });
  }

  public verify(token: string): string {
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
      });

      if (typeof payload === 'string') {
        throw new InvalidTokenError('The access token is invalid.');
      }

      if (
        payload.iss !== 'og-lab-be' ||
        payload.aud !== 'og-lab-api' ||
        payload.sub === undefined
      ) {
        throw new InvalidTokenError('The access token is invalid.');
      }

      return payload.sub;
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw error;
      }

      if (error instanceof JsonWebTokenError) {
        throw new InvalidTokenError('The access token is invalid.');
      }

      throw error;
    }
  }
}

async function deriveKey(
  password: string,
  salt: string,
  runScrypt: ScryptRunner,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    runScrypt(
      password,
      salt,
      derivedKeyBytes,
      {
        N: 16384,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024,
      },
      (error, key) => {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve(key);
      },
    );
  });
}
