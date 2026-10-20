import request from 'supertest';
import { createApp } from '../app.js';
import {
  UserService,
  type UserRecord,
} from '../domain/users.js';

describe('createApp', () => {
  const app = () => {
    const user: UserRecord = {
      id: 'user-1',
      username: 'member',
      email: 'member@example.com',
      passwordHash: 'hash',
      profileImageKey: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const service = new UserService(
      {
        create: () => Promise.resolve(user),
        findByEmail: () => Promise.resolve(user),
        findById: () => Promise.resolve(user),
        updateUsername: () => Promise.resolve(user),
        updatePasswordHash: (_id, passwordHash) =>
          Promise.resolve({ ...user, passwordHash }),
        updateProfileImage: () => Promise.resolve(user),
        delete: () => Promise.resolve(true),
      },
      {
        hash: () => Promise.resolve('hash'),
        verify: () => Promise.resolve(true),
      },
      {
        issue: () => 'token',
        verify: () => 'user-1',
      },
      {
        store: () => Promise.resolve('profiles/image.jpg'),
        delete: () => Promise.resolve(),
      },
      { create: () => 'https://images.example.com/profile.webp' },
    );

    return createApp({
      users: service,
      tokens: { issue: () => 'token', verify: () => 'user-1' },
    });
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a healthy status response', async () => {
    await request(app())
      .get('/health')
      .expect(200, { status: 'ok' });
  });

  it('logs the method, path, status, and duration of completed requests', async () => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await request(app())
      .get('/health')
      .expect(200, { status: 'ok' });

    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[HTTP\] GET \/health 200 \d+ms$/),
    );
  });
});
