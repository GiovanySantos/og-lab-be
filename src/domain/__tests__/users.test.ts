import {
  DuplicateUserError,
  InvalidCredentialsError,
  UserInputError,
  UserNotFoundError,
  UserService,
  type UserRecord,
} from '../users.js';

const record: UserRecord = {
  id: 'user-123',
  username: 'member',
  email: 'member@example.com',
  passwordHash: 'encoded-password',
  profileImageKey: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createFixture() {
  const users = {
    create: jest.fn((input: {
      username: string;
      email: string;
      passwordHash: string;
    }) => Promise.resolve({ ...record, ...input })),
    findByEmail: jest.fn((): Promise<UserRecord | null> => Promise.resolve(record)),
    findById: jest.fn((): Promise<UserRecord | null> => Promise.resolve(record)),
    updateUsername: jest.fn(
      (_id: string, username: string): Promise<UserRecord | null> =>
        Promise.resolve({ ...record, username }),
    ),
    updatePasswordHash: jest.fn(
      (_id: string, passwordHash: string): Promise<UserRecord | null> =>
        Promise.resolve({ ...record, passwordHash }),
    ),
    updateProfileImage: jest.fn(
      (_id: string, key: string): Promise<UserRecord | null> =>
        Promise.resolve({ ...record, profileImageKey: key }),
    ),
    delete: jest.fn(() => Promise.resolve(true)),
  };
  const passwords = {
    hash: jest.fn(() => Promise.resolve('encoded-password')),
    verify: jest.fn(() => Promise.resolve(true)),
  };
  const tokens = { issue: jest.fn(() => 'signed-token'), verify: jest.fn() };
  const images = {
    store: jest.fn(() => Promise.resolve('profiles/new.webp')),
    delete: jest.fn(() => Promise.resolve()),
  };
  const imageUrls = {
    create: jest.fn((key: string) => `https://thumbor.example/${key}`),
  };
  const service = new UserService(
    users,
    passwords,
    tokens,
    images,
    imageUrls,
  );

  return { service, users, passwords, tokens, images, imageUrls };
}

describe('UserService', () => {
  it('registers with a normalized email and never returns the password hash', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.register({
        username: ' member ',
        email: ' MEMBER@Example.COM ',
        password: 'a-strong-password',
      }),
    ).resolves.toEqual({
      user: {
        id: record.id,
        username: 'member',
        email: 'member@example.com',
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        profileImageUrl: null,
      },
      accessToken: 'signed-token',
    });
    expect(fixture.users.create).toHaveBeenCalledWith({
      username: 'member',
      email: 'member@example.com',
      passwordHash: 'encoded-password',
    });
  });

  it.each(['ab', 'a'.repeat(33)])(
    'rejects usernames with invalid lengths',
    async (username) => {
      const fixture = createFixture();
      await expect(
        fixture.service.register({
          username,
          email: 'member@example.com',
          password: 'a-strong-password',
        }),
      ).rejects.toBeInstanceOf(UserInputError);
    },
  );

  it.each(['not-an-email', 'a'.repeat(250) + '@example.com'])(
    'rejects invalid email addresses',
    async (email) => {
      const fixture = createFixture();
      await expect(
        fixture.service.register({
          username: 'member',
          email,
          password: 'a-strong-password',
        }),
      ).rejects.toBeInstanceOf(UserInputError);
    },
  );

  it.each(['short', 'p'.repeat(129)])(
    'rejects passwords with invalid lengths',
    async (password) => {
      const fixture = createFixture();
      await expect(
        fixture.service.register({
          username: 'member',
          email: 'member@example.com',
          password,
        }),
      ).rejects.toBeInstanceOf(UserInputError);
    },
  );

  it('propagates duplicate username or email errors from the repository', async () => {
    const fixture = createFixture();
    fixture.users.create.mockRejectedValue(
      new DuplicateUserError('Username or email is already in use.'),
    );

    await expect(
      fixture.service.register({
        username: 'member',
        email: 'member@example.com',
        password: 'a-strong-password',
      }),
    ).rejects.toBeInstanceOf(DuplicateUserError);
  });

  it('logs in with a case-insensitive email', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.login({
        email: 'MEMBER@example.com',
        password: 'a-strong-password',
      }),
    ).resolves.toMatchObject({
      user: { id: record.id, profileImageUrl: null },
      accessToken: 'signed-token',
    });
    expect(fixture.users.findByEmail).toHaveBeenCalledWith(
      'member@example.com',
    );
  });

  it('rejects login when the account does not exist', async () => {
    const fixture = createFixture();
    fixture.users.findByEmail.mockResolvedValue(null);

    await expect(
      fixture.service.login({
        email: 'member@example.com',
        password: 'a-strong-password',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(fixture.passwords.verify).not.toHaveBeenCalled();
  });

  it('rejects login when the password does not match', async () => {
    const fixture = createFixture();
    fixture.passwords.verify.mockResolvedValue(false);

    await expect(
      fixture.service.login({
        email: 'member@example.com',
        password: 'incorrect-password',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejects malformed email addresses during login', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.login({ email: 'not-an-email', password: 'secret' }),
    ).rejects.toBeInstanceOf(UserInputError);
  });

  it('returns the profile and a Thumbor URL when the profile image exists', async () => {
    const fixture = createFixture();
    fixture.users.findById.mockResolvedValue({
      ...record,
      profileImageKey: 'profiles/avatar.webp',
    });

    await expect(fixture.service.getProfile(record.id)).resolves.toMatchObject({
      profileImageUrl: 'https://thumbor.example/profiles/avatar.webp',
    });
    expect(fixture.imageUrls.create).toHaveBeenCalledWith(
      'profiles/avatar.webp',
    );
  });

  it('returns not found when the requested profile does not exist', async () => {
    const fixture = createFixture();
    fixture.users.findById.mockResolvedValue(null);

    await expect(
      fixture.service.getProfile('missing-user'),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('updates a username and converts the result to a public user', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.updateUsername(record.id, 'new-name'),
    ).resolves.toMatchObject({ username: 'new-name' });
  });

  it('rejects invalid username updates', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.updateUsername(record.id, 'ab'),
    ).rejects.toBeInstanceOf(UserInputError);
  });

  it('returns not found when username update affects no user', async () => {
    const fixture = createFixture();
    fixture.users.updateUsername.mockResolvedValue(null);

    await expect(
      fixture.service.updateUsername(record.id, 'new-name'),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('changes a password after verifying the current password', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.changePassword(
        record.id,
        'current-password',
        'a-new-strong-password',
      ),
    ).resolves.toMatchObject({ id: record.id });
    expect(fixture.passwords.verify).toHaveBeenCalledWith(
      'current-password',
      record.passwordHash,
    );
    expect(fixture.passwords.hash).toHaveBeenCalledWith(
      'a-new-strong-password',
    );
    expect(fixture.users.updatePasswordHash).toHaveBeenCalledWith(
      record.id,
      'encoded-password',
    );
  });

  it('rejects an incorrect current password', async () => {
    const fixture = createFixture();
    fixture.passwords.verify.mockResolvedValue(false);

    await expect(
      fixture.service.changePassword(
        record.id,
        'incorrect-password',
        'a-new-strong-password',
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(fixture.passwords.hash).not.toHaveBeenCalled();
  });

  it('rejects an oversized current password without verifying it', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.changePassword(
        record.id,
        'p'.repeat(129),
        'a-new-strong-password',
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(fixture.passwords.verify).not.toHaveBeenCalled();
  });

  it('validates the new password length', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.changePassword(record.id, 'current-password', 'short'),
    ).rejects.toBeInstanceOf(UserInputError);
  });

  it('returns not found when the account is absent during password change', async () => {
    const fixture = createFixture();
    fixture.users.findById.mockResolvedValue(null);

    await expect(
      fixture.service.changePassword(
        record.id,
        'current-password',
        'a-new-strong-password',
      ),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('returns not found when the password update affects no user', async () => {
    const fixture = createFixture();
    fixture.users.updatePasswordHash.mockResolvedValue(null);

    await expect(
      fixture.service.changePassword(
        record.id,
        'current-password',
        'a-new-strong-password',
      ),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('rejects empty profile images', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.uploadProfileImage(
        record.id,
        Buffer.alloc(0),
        'image/jpeg',
      ),
    ).rejects.toBeInstanceOf(UserInputError);
  });

  it('rejects profile images larger than 5 MB', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.uploadProfileImage(
        record.id,
        Buffer.alloc(5 * 1024 * 1024 + 1),
        'image/jpeg',
      ),
    ).rejects.toBeInstanceOf(UserInputError);
  });

  it('does not store a profile image for a missing user', async () => {
    const fixture = createFixture();
    fixture.users.findById.mockResolvedValue(null);

    await expect(
      fixture.service.uploadProfileImage(
        record.id,
        Buffer.from('image'),
        'image/png',
      ),
    ).rejects.toBeInstanceOf(UserNotFoundError);
    expect(fixture.images.store).not.toHaveBeenCalled();
  });

  it('stores an image, updates the profile and removes the previous image', async () => {
    const fixture = createFixture();
    fixture.users.findById.mockResolvedValue({
      ...record,
      profileImageKey: 'profiles/old.webp',
    });

    await expect(
      fixture.service.uploadProfileImage(
        record.id,
        Buffer.from('image'),
        'image/webp',
      ),
    ).resolves.toMatchObject({
      profileImageUrl: 'https://thumbor.example/profiles/new.webp',
    });
    expect(fixture.images.delete).toHaveBeenCalledWith('profiles/old.webp');
  });

  it('removes an unreferenced image when the profile update reports no user', async () => {
    const fixture = createFixture();
    fixture.users.updateProfileImage.mockResolvedValue(null);

    await expect(
      fixture.service.uploadProfileImage(
        record.id,
        Buffer.from('image'),
        'image/png',
      ),
    ).rejects.toBeInstanceOf(UserNotFoundError);
    expect(fixture.images.delete).toHaveBeenCalledWith('profiles/new.webp');
  });

  it('deletes a user without an image', async () => {
    const fixture = createFixture();

    await expect(fixture.service.deleteAccount(record.id)).resolves.toBeUndefined();
    expect(fixture.users.delete).toHaveBeenCalledWith(record.id);
    expect(fixture.images.delete).not.toHaveBeenCalled();
  });

  it('deletes a user image after deleting the account', async () => {
    const fixture = createFixture();
    fixture.users.findById.mockResolvedValue({
      ...record,
      profileImageKey: 'profiles/avatar.webp',
    });

    await fixture.service.deleteAccount(record.id);
    expect(fixture.images.delete).toHaveBeenCalledWith('profiles/avatar.webp');
  });

  it('returns not found when the account is already absent', async () => {
    const fixture = createFixture();
    fixture.users.findById.mockResolvedValue(null);

    await expect(
      fixture.service.deleteAccount(record.id),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('returns not found when account deletion affects no database row', async () => {
    const fixture = createFixture();
    fixture.users.delete.mockResolvedValue(false);

    await expect(
      fixture.service.deleteAccount(record.id),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
