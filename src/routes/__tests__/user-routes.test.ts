import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import type { Test as SupertestTest } from 'supertest';
import {
  DuplicateUserError,
  ImageStorageError,
  InvalidCredentialsError,
  InvalidTokenError,
  UserNotFoundError,
  UserRepositoryError,
  UserService,
  type ImageContentType,
  type UserRecord,
} from '../../domain/users.js';
import {
  createAuthRouter,
  createErrorHandler,
  createUserRouter,
} from '../user-routes.js';

const user: UserRecord = {
  id: 'user-123',
  username: 'member',
  email: 'member@example.com',
  passwordHash: 'password-hash',
  profileImageKey: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const imageCases: ReadonlyArray<{
  contentType: ImageContentType;
  image: number[];
}> = [
  { contentType: 'image/jpeg', image: [0xff, 0xd8, 0xff] },
  {
    contentType: 'image/png',
    image: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    contentType: 'image/webp',
    image: [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')],
  },
];

function fixture() {
  const users: UserService = new UserService(
    {
      create: () => Promise.resolve(user),
      findByEmail: () => Promise.resolve(user),
      findById: () => Promise.resolve(user),
      updateUsername: (_id, username) =>
        Promise.resolve({ ...user, username }),
      updatePasswordHash: (_id, passwordHash) =>
        Promise.resolve({ ...user, passwordHash }),
      updateProfileImage: (_id, key) =>
        Promise.resolve({ ...user, profileImageKey: key }),
      delete: () => Promise.resolve(true),
    },
    {
      hash: () => Promise.resolve('hash'),
      verify: () => Promise.resolve(true),
    },
    {
      issue: () => 'access-token',
      verify: (token) => {
        if (token === 'invalid') {
          throw new InvalidTokenError('invalid');
        }
        return user.id;
      },
    },
    {
      store: () => Promise.resolve('users/user-123/images/new.webp'),
      delete: () => Promise.resolve(),
      deleteUserImages: () => Promise.resolve(),
    },
    { create: () => 'https://thumbor.example/signed/profile.webp' },
    {
      listPending: () => Promise.resolve([]),
      listPendingForUser: () => Promise.resolve([]),
      complete: () => Promise.resolve(),
      retry: () => Promise.resolve(),
    },
  );
  const app: Express = express();
  const forwardedError: jest.Mock = jest.fn();
  app.use(express.json({ strict: false }));
  app.use('/auth', createAuthRouter(users));
  app.use('/users', createUserRouter(users, {
    issue: () => 'access-token',
    verify: (token) => {
      if (token === 'invalid') {
        throw new InvalidTokenError('invalid');
      }
      return user.id;
    },
  }));
  app.get('/already-sent', (_request, response, next) => {
    response.status(200).end();
    next(new Error('response already sent'));
  });
  app.use(createErrorHandler());
  app.use((
    error: Error,
    _request: Request,
    _response: Response,
    next: NextFunction,
  ) => {
    forwardedError(error);
    next();
  });

  return { app, users, forwardedError };
}

type RouteFixture = ReturnType<typeof fixture>;

describe('user routes', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers an account and returns an access token', async () => {
    const { app, users }: RouteFixture = fixture();
    const register: jest.SpyInstance = jest
      .spyOn(users, 'register')
      .mockResolvedValue({ user: { ...user, profileImageUrl: null }, accessToken: 'jwt' });

    await request(app)
      .post('/auth/register')
      .send({
        username: 'member',
        email: 'member@example.com',
        password: 'a-strong-password',
      })
      .expect(201, {
        user: { ...user, profileImageUrl: null },
        accessToken: 'jwt',
      });

    expect(register).toHaveBeenCalledWith({
      username: 'member',
      email: 'member@example.com',
      password: 'a-strong-password',
    });
  });

  it('rejects registration requests with missing or non-string fields', async () => {
    const { app }: RouteFixture = fixture();

    await request(app)
      .post('/auth/register')
      .send({ username: 'member' })
      .expect(400);
    await request(app)
      .post('/auth/register')
      .send({
        username: 'member',
        email: 'member@example.com',
        password: 12,
      })
      .expect(400);
    await request(app)
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .send('null')
      .expect(400);
    await request(app)
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .send('[]')
      .expect(400);
    await request(app).post('/auth/register').expect(400);
  });

  it('returns a bad request for malformed JSON', async () => {
    const { app }: RouteFixture = fixture();

    await request(app)
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400, { error: 'Request body must contain valid JSON.' });
  });

  it('returns a conflict when a username or email is already used', async () => {
    const { app, users }: RouteFixture = fixture();
    jest
      .spyOn(users, 'register')
      .mockRejectedValue(new DuplicateUserError('Username or email is already in use.'));

    await request(app)
      .post('/auth/register')
      .send({
        username: 'member',
        email: 'member@example.com',
        password: 'a-strong-password',
      })
      .expect(409, { error: 'Username or email is already in use.' });
  });

  it('logs in and returns an access token', async () => {
    const { app, users }: RouteFixture = fixture();
    jest
      .spyOn(users, 'login')
      .mockResolvedValue({ user: { ...user, profileImageUrl: null }, accessToken: 'jwt' });

    await request(app)
      .post('/auth/login')
      .send({ email: 'member@example.com', password: 'a-strong-password' })
      .expect(200);
  });

  it('rejects login requests with missing fields', async () => {
    const { app }: RouteFixture = fixture();

    await request(app)
      .post('/auth/login')
      .send({ email: 'member@example.com' })
      .expect(400);
  });

  it('returns an unauthorized response for invalid credentials', async () => {
    const { app, users }: RouteFixture = fixture();
    jest
      .spyOn(users, 'login')
      .mockRejectedValue(new InvalidCredentialsError('invalid'));

    await request(app)
      .post('/auth/login')
      .send({ email: 'member@example.com', password: 'wrong-password' })
      .expect(401, { error: 'Authentication failed.' });
  });

  it.each([undefined, 'Basic abc', 'Bearer invalid extra'])(
    'requires a well-formed bearer token: %s',
    async (authorization) => {
      const { app }: RouteFixture = fixture();
      const test: SupertestTest = request(app).get('/users/me');
      if (authorization !== undefined) {
        test.set('Authorization', authorization);
      }

      await test.expect(401, { error: 'Authentication failed.' });
    },
  );

  it('returns the authenticated user profile', async () => {
    const { app }: RouteFixture = fixture();
    await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer valid')
      .expect(200, {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        profileImageUrl: null,
      });
  });

  it('rejects a bearer token that fails verification', async () => {
    const { app }: RouteFixture = fixture();
    await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });

  it('updates the authenticated user username', async () => {
    const { app }: RouteFixture = fixture();
    const response: SupertestResponse = await request(app)
      .patch('/users/me')
      .set('Authorization', 'Bearer valid')
      .send({ username: 'new-name' })
      .expect(200);
    expect(response.body).toMatchObject({ username: 'new-name' });
  });

  it('rejects updates that attempt to change protected or multiple fields', async () => {
    const { app }: RouteFixture = fixture();
    await request(app)
      .patch('/users/me')
      .set('Authorization', 'Bearer valid')
      .send({ username: 'new-name', email: 'different@example.com' })
      .expect(400);
  });

  it('rejects an update without a username', async () => {
    const { app }: RouteFixture = fixture();
    await request(app)
      .patch('/users/me')
      .set('Authorization', 'Bearer valid')
      .send({})
      .expect(400);
  });

  it('changes a password after current-password reauthentication', async () => {
    const { app, users }: RouteFixture = fixture();
    const changePassword: jest.SpyInstance = jest.spyOn(
      users,
      'changePassword',
    );

    await request(app)
      .patch('/users/me/password')
      .set('Authorization', 'Bearer valid')
      .send({
        currentPassword: 'current-password',
        newPassword: 'a-new-strong-password',
      })
      .expect(200);
    expect(changePassword).toHaveBeenCalledWith(
      user.id,
      'current-password',
      'a-new-strong-password',
    );
  });

  it('rejects a password-change request missing either password', async () => {
    const { app }: RouteFixture = fixture();

    await request(app)
      .patch('/users/me/password')
      .set('Authorization', 'Bearer valid')
      .send({ currentPassword: 'current-password' })
      .expect(400);
    await request(app)
      .patch('/users/me/password')
      .set('Authorization', 'Bearer valid')
      .send({ currentPassword: 'current-password', other: 'value' })
      .expect(400);
  });

  it('returns unauthorized when the current password does not match', async () => {
    const { app, users }: RouteFixture = fixture();
    jest
      .spyOn(users, 'changePassword')
      .mockRejectedValue(new InvalidCredentialsError('incorrect'));

    await request(app)
      .patch('/users/me/password')
      .set('Authorization', 'Bearer valid')
      .send({
        currentPassword: 'incorrect',
        newPassword: 'a-new-strong-password',
      })
      .expect(401);
  });

  it('returns not found when the authenticated user does not exist', async () => {
    const { app, users }: RouteFixture = fixture();
    jest
      .spyOn(users, 'getProfile')
      .mockRejectedValue(new UserNotFoundError('User was not found.'));

    await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer valid')
      .expect(404, { error: 'User was not found.' });
  });

  it('rejects unsupported profile image content types', async () => {
    const { app }: RouteFixture = fixture();
    await request(app)
      .post('/users/me/profile-image')
      .set('Authorization', 'Bearer valid')
      .set('Content-Type', 'image/gif')
      .send(Buffer.from('gif'))
      .expect(415, { error: 'Use a JPEG, PNG, or WebP image.' });
  });

  it('rejects empty profile image uploads', async () => {
    const { app }: RouteFixture = fixture();
    await request(app)
      .post('/users/me/profile-image')
      .set('Authorization', 'Bearer valid')
      .set('Content-Type', 'image/png')
      .send(Buffer.alloc(0))
      .expect(400);
  });

  it('rejects a parsed profile image body that is not binary', async () => {
    const rawParser: jest.SpyInstance = jest
      .spyOn(express, 'raw')
      .mockImplementation(() => (request, _response, next) => {
        Object.defineProperty(request, 'body', {
          value: 'not-binary',
          configurable: true,
        });
        next();
      });
    const { app }: RouteFixture = fixture();

    await request(app)
      .post('/users/me/profile-image')
      .set('Authorization', 'Bearer valid')
      .set('Content-Type', 'image/png')
      .send('image')
      .expect(400);
    rawParser.mockRestore();
  });

  it.each(imageCases)(
    'uploads an authenticated $contentType profile image',
    async ({
      contentType,
      image,
    }: { contentType: ImageContentType; image: number[] }) => {
    const { app, users }: RouteFixture = fixture();
    const upload: jest.SpyInstance = jest
      .spyOn(users, 'uploadProfileImage')
      .mockResolvedValue({
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        profileImageUrl: 'https://thumbor.example/signed/profile.webp',
        },
      );
    const imageBuffer: Buffer = Buffer.from(image);

    await request(app)
      .post('/users/me/profile-image')
      .set('Authorization', 'Bearer valid')
      .set('Content-Type', contentType)
      .send(imageBuffer)
      .expect(200);
    expect(upload).toHaveBeenCalledWith(user.id, imageBuffer, contentType);
  });

  it('rejects content that does not match its declared image type', async () => {
    const { app }: RouteFixture = fixture();

    await request(app)
      .post('/users/me/profile-image')
      .set('Authorization', 'Bearer valid')
      .set('Content-Type', 'image/png')
      .send(Buffer.from('not a png'))
      .expect(400, {
        error: 'Image content does not match its content type.',
      });
  });

  it('rejects profile image uploads larger than 5 MB', async () => {
    const { app }: RouteFixture = fixture();
    await request(app)
      .post('/users/me/profile-image')
      .set('Authorization', 'Bearer valid')
      .set('Content-Type', 'image/jpeg')
      .send(Buffer.alloc(5 * 1024 * 1024 + 1))
      .expect(413, { error: 'Image must not exceed 5 MB.' });
  });

  it('logs R2 failures and returns a service-unavailable response', async () => {
    const { app, users }: RouteFixture = fixture();
    const log: jest.SpyInstance = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    jest
      .spyOn(users, 'uploadProfileImage')
      .mockRejectedValue(new ImageStorageError('R2 image upload failed.'));

    await request(app)
      .post('/users/me/profile-image')
      .set('Authorization', 'Bearer valid')
      .set('Content-Type', 'image/png')
      .send(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      .expect(502, {
        error: 'Profile image storage is unavailable.',
      });
    expect(log).toHaveBeenCalledWith(
      '[HTTP] Profile image storage request failed',
      expect.any(ImageStorageError),
    );
  });

  it('deletes the authenticated account', async () => {
    const { app, users }: RouteFixture = fixture();
    const deletion: jest.SpyInstance = jest.spyOn(users, 'deleteAccount');

    await request(app)
      .delete('/users/me')
      .set('Authorization', 'Bearer valid')
      .expect(204);
    expect(deletion).toHaveBeenCalledWith(user.id);
  });

  it('logs repository failures and returns a service-unavailable response', async () => {
    const { app, users }: RouteFixture = fixture();
    const log: jest.SpyInstance = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    jest
      .spyOn(users, 'getProfile')
      .mockRejectedValue(new UserRepositoryError('database unavailable'));

    await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer valid')
      .expect(502, { error: 'User service is unavailable.' });
    expect(log).toHaveBeenCalledWith(
      '[HTTP] User repository request failed',
      expect.any(UserRepositoryError),
    );
  });

  it('logs unexpected failures and returns a generic server error', async () => {
    const { app, users }: RouteFixture = fixture();
    const log: jest.SpyInstance = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(users, 'getProfile').mockRejectedValue(new Error('unexpected'));

    await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer valid')
      .expect(500, { error: 'An unexpected error occurred.' });
    expect(log).toHaveBeenCalledWith(
      '[HTTP] Unhandled request error',
      expect.any(Error),
    );
  });

  it('forwards errors after response headers have been sent', async () => {
    const { app, forwardedError }: RouteFixture = fixture();

    await request(app).get('/already-sent').expect(200);
    expect(forwardedError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'response already sent' }),
    );
  });
});
