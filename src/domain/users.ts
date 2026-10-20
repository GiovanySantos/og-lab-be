import type {
  PendingProfileImageCleanup,
  ProfileImageCleanupRepository,
} from './profile-image-cleanup.js';

export type UserRecord = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  profileImageKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicUser = Omit<UserRecord, 'passwordHash' | 'profileImageKey'> & {
  profileImageUrl: string | null;
};

export type NewUser = {
  username: string;
  email: string;
  passwordHash: string;
};

export interface UserRepository {
  create(user: NewUser): Promise<UserRecord>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  updateUsername(id: string, username: string): Promise<UserRecord | null>;
  updatePasswordHash(id: string, passwordHash: string): Promise<UserRecord | null>;
  updateProfileImage(id: string, profileImageKey: string): Promise<UserRecord | null>;
  delete(id: string): Promise<boolean>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export interface TokenService {
  issue(userId: string): string;
  verify(token: string): string;
}

export interface ImageStorage {
  store(
    userId: string,
    image: Buffer,
    contentType: ImageContentType,
  ): Promise<string>;
  delete(key: string): Promise<void>;
  deleteUserImages(userId: string): Promise<void>;
}

export interface ImageUrlGenerator {
  create(key: string): string;
}

export type ImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';

export type AuthenticatedUser = {
  user: PublicUser;
  accessToken: string;
};

export class UserInputError extends Error {}
export class DuplicateUserError extends Error {}
export class InvalidCredentialsError extends Error {}
export class InvalidTokenError extends Error {}
export class ImageStorageError extends Error {}
export class UserNotFoundError extends Error {}
export class UserRepositoryError extends Error {}

export class UserService {
  public constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly images: ImageStorage,
    private readonly imageUrls: ImageUrlGenerator,
    private readonly imageCleanup: ProfileImageCleanupRepository,
  ) {}

  public async register(input: {
    username: string;
    email: string;
    password: string;
  }): Promise<AuthenticatedUser> {
    const username: string = validateUsername(input.username);
    const email: string = validateEmail(input.email);
    const password: string = validatePassword(input.password);
    const passwordHash: string = await this.passwords.hash(password);
    const user: UserRecord = await this.users.create({
      username,
      email,
      passwordHash,
    });
    return this.authenticatedUser(user);
  }

  public async login(input: {
    email: string;
    password: string;
  }): Promise<AuthenticatedUser> {
    const email: string = validateEmail(input.email);
    const user: UserRecord | null = await this.users.findByEmail(email);

    if (
      user === null ||
      !(await this.passwords.verify(input.password, user.passwordHash))
    ) {
      throw new InvalidCredentialsError('Invalid email or password.');
    }

    return this.authenticatedUser(user);
  }

  public async getProfile(userId: string): Promise<PublicUser> {
    const user: UserRecord = await this.getUser(userId);
    return this.toPublicUser(user);
  }

  public async updateUsername(
    userId: string,
    usernameInput: string,
  ): Promise<PublicUser> {
    const username: string = validateUsername(usernameInput);
    const updated: UserRecord | null = await this.users.updateUsername(
      userId,
      username,
    );

    if (updated === null) {
      throw new UserNotFoundError('User was not found.');
    }

    return this.toPublicUser(updated);
  }

  public async changePassword(
    userId: string,
    currentPassword: string,
    newPasswordInput: string,
  ): Promise<PublicUser> {
    if (
      currentPassword.length > 128 ||
      !(await this.passwords.verify(
        currentPassword,
        (await this.getUser(userId)).passwordHash,
      ))
    ) {
      throw new InvalidCredentialsError('Current password is incorrect.');
    }

    const newPassword: string = validatePassword(newPasswordInput);
    const passwordHash: string = await this.passwords.hash(newPassword);
    const updated: UserRecord | null = await this.users.updatePasswordHash(
      userId,
      passwordHash,
    );

    if (updated === null) {
      throw new UserNotFoundError('User was not found.');
    }

    return this.toPublicUser(updated);
  }

  public async uploadProfileImage(
    userId: string,
    image: Buffer,
    contentType: ImageContentType,
  ): Promise<PublicUser> {
    if (image.length === 0 || image.length > 5 * 1024 * 1024) {
      throw new UserInputError('Image must be between 1 byte and 5 MB.');
    }

    await this.getUser(userId);
    const newKey: string = await this.images.store(
      userId,
      image,
      contentType,
    );
    const updated: UserRecord | null = await this.users.updateProfileImage(
      userId,
      newKey,
    );

    if (updated === null) {
      await this.images.delete(newKey);
      throw new UserNotFoundError('User was not found.');
    }

    return this.toPublicUser(updated);
  }

  public async deleteAccount(userId: string): Promise<void> {
    const user: UserRecord = await this.getUser(userId);
    await this.images.deleteUserImages(userId);

    if (
      user.profileImageKey !== null &&
      !user.profileImageKey.startsWith(`users/${userId}/images/`)
    ) {
      await this.images.delete(user.profileImageKey);
    }

    let pending: PendingProfileImageCleanup[] =
      await this.imageCleanup.listPendingForUser(userId);

    while (pending.length > 0) {
      for (const job of pending) {
        await this.images.delete(job.objectKey);
        await this.imageCleanup.complete(job.id);
      }

      pending = await this.imageCleanup.listPendingForUser(userId);
    }

    const deleted: boolean = await this.users.delete(userId);

    if (!deleted) {
      throw new UserNotFoundError('User was not found.');
    }
  }

  private async getUser(userId: string): Promise<UserRecord> {
    const user: UserRecord | null = await this.users.findById(userId);

    if (user === null) {
      throw new UserNotFoundError('User was not found.');
    }

    return user;
  }

  private authenticatedUser(user: UserRecord): AuthenticatedUser {
    return {
      user: this.toPublicUser(user),
      accessToken: this.tokens.issue(user.id),
    };
  }

  private toPublicUser(user: UserRecord): PublicUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profileImageUrl:
        user.profileImageKey === null
          ? null
          : this.imageUrls.create(user.profileImageKey),
    };
  }
}

function validateUsername(value: string): string {
  const username: string = value.trim();

  if (username.length < 3 || username.length > 32) {
    throw new UserInputError('Username must contain between 3 and 32 characters.');
  }

  return username;
}

function validateEmail(value: string): string {
  const email: string = value.trim().toLowerCase();

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new UserInputError('A valid email address is required.');
  }

  return email;
}

function validatePassword(value: string): string {
  if (value.length < 12 || value.length > 128) {
    throw new UserInputError('Password must contain between 12 and 128 characters.');
  }

  return value;
}
