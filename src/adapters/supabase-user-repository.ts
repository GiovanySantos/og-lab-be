import {
  DuplicateUserError,
  UserRepositoryError,
  type NewUser,
  type UserRecord,
  type UserRepository,
} from '../domain/users.js';
import {
  SupabaseRestError,
  type SupabaseRestClient,
  type SupabaseRestResponse,
} from './supabase-rest-client.js';

export class SupabaseUserRepository implements UserRepository {
  public constructor(
    private readonly projectUrl: string,
    private readonly client: SupabaseRestClient,
  ) {}

  public async create(user: NewUser): Promise<UserRecord> {
    const result: SupabaseRestResponse = await this.request(
      this.usersUrl(),
      {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          username: user.username,
          email: user.email,
          password_hash: user.passwordHash,
        }),
      },
    );
    return firstUser(result);
  }

  public async findByEmail(email: string): Promise<UserRecord | null> {
    const url: URL = this.usersUrl();
    url.searchParams.set('select', '*');
    url.searchParams.set('email', `eq.${email}`);
    url.searchParams.set('limit', '1');
    return optionalFirstUser(await this.request(url));
  }

  public async findById(id: string): Promise<UserRecord | null> {
    const url: URL = this.usersUrl();
    url.searchParams.set('select', '*');
    url.searchParams.set('id', `eq.${id}`);
    url.searchParams.set('limit', '1');
    return optionalFirstUser(await this.request(url));
  }

  public async updateUsername(
    id: string,
    username: string,
  ): Promise<UserRecord | null> {
    const url: URL = this.usersUrl();
    url.searchParams.set('id', `eq.${id}`);
    const result: SupabaseRestResponse = await this.request(url, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ username }),
    });
    return optionalFirstUser(result);
  }

  public async updatePasswordHash(
    id: string,
    passwordHash: string,
  ): Promise<UserRecord | null> {
    const url: URL = this.usersUrl();
    url.searchParams.set('id', `eq.${id}`);
    const result: SupabaseRestResponse = await this.request(url, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ password_hash: passwordHash }),
    });
    return optionalFirstUser(result);
  }

  public async updateProfileImage(
    id: string,
    profileImageKey: string,
  ): Promise<UserRecord | null> {
    const url: URL = this.usersUrl();
    url.searchParams.set('id', `eq.${id}`);
    const result: SupabaseRestResponse = await this.request(url, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ profile_image_key: profileImageKey }),
    });
    return optionalFirstUser(result);
  }

  public async delete(id: string): Promise<boolean> {
    const url: URL = this.usersUrl();
    url.searchParams.set('id', `eq.${id}`);
    const result: SupabaseRestResponse = await this.request(url, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    });
    return Array.isArray(result) && result.length > 0;
  }

  private usersUrl(): URL {
    return new URL('/rest/v1/users', this.projectUrl);
  }

  private async request(
    url: URL,
    init?: RequestInit,
  ): Promise<SupabaseRestResponse> {
    try {
      return await this.client.request(url, init);
    } catch (error) {
      if (error instanceof SupabaseRestError && error.code === '23505') {
        throw new DuplicateUserError('Username or email is already in use.');
      }

      if (error instanceof SupabaseRestError) {
        throw new UserRepositoryError(
          'Supabase user request failed.',
          { cause: error },
        );
      }

      throw error;
    }
  }
}

function optionalFirstUser(
  result: SupabaseRestResponse,
): UserRecord | null {
  if (result === null) {
    return null;
  }

  if (!isObjectArray(result)) {
    throw new UserRepositoryError('Supabase returned an invalid user result.');
  }

  const firstUser: object | undefined = result[0];

  if (firstUser !== undefined) {
    return parseUser(firstUser);
  }

  return null;
}

function firstUser(result: SupabaseRestResponse): UserRecord {
  const user: UserRecord | null = optionalFirstUser(result);

  if (user === null) {
    throw new UserRepositoryError('Supabase did not return the created user.');
  }

  return user;
}

function parseUser(value: object): UserRecord {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    typeof value['username'] !== 'string' ||
    typeof value['email'] !== 'string' ||
    typeof value['password_hash'] !== 'string' ||
    (typeof value['profile_image_key'] !== 'string' &&
      value['profile_image_key'] !== null) ||
    typeof value['created_at'] !== 'string' ||
    typeof value['updated_at'] !== 'string'
  ) {
    throw new UserRepositoryError('Supabase returned a malformed user record.');
  }

  return {
    id: value['id'],
    username: value['username'],
    email: value['email'],
    passwordHash: value['password_hash'],
    profileImageKey: value['profile_image_key'],
    createdAt: value['created_at'],
    updatedAt: value['updated_at'],
  };
}

function isRecord(value: object): value is Record<string, string | null> {
  return Object.values(value).every(
    (field) => typeof field === 'string' || field === null,
  );
}

function isObjectArray(value: SupabaseRestResponse): value is object[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'object' && item !== null)
  );
}
