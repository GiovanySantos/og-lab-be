import {
  DuplicateUserError,
  UserRepositoryError,
  type UserRecord,
} from '../../domain/users.js';
import { FetchSupabaseRestClient } from '../supabase-rest-client.js';
import { SupabaseUserRepository } from '../supabase-user-repository.js';

const userRecord: {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  profile_image_key: string | null;
  created_at: string;
  updated_at: string;
} = {
  id: 'user-123',
  username: 'member',
  email: 'member@example.com',
  password_hash: 'scrypt-hash',
  profile_image_key: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function fixture(initial: Response = Response.json([userRecord])) {
  let response: Response = initial;
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetcher: typeof fetch = (input, init) => {
    calls.push({
      url:
        input instanceof URL
          ? input.href
          : typeof input === 'string'
            ? input
            : input.url,
      init,
    });
    return Promise.resolve(response);
  };

  return {
    repository: new SupabaseUserRepository(
      'https://project.supabase.co',
      new FetchSupabaseRestClient('service-role-key', fetcher),
    ),
    calls,
    setResponse: (next: Response) => {
      response = next;
    },
  };
}

type Fixture = ReturnType<typeof fixture>;

describe('SupabaseUserRepository', () => {
  it('creates a user and maps the Supabase row', async () => {
    const setup: Fixture = fixture(Response.json([userRecord], { status: 201 }));

    await expect(
      setup.repository.create({
        username: 'member',
        email: 'member@example.com',
        passwordHash: 'scrypt-hash',
      }),
    ).resolves.toEqual<UserRecord>({
      id: 'user-123',
      username: 'member',
      email: 'member@example.com',
      passwordHash: 'scrypt-hash',
      profileImageKey: null,
      createdAt: userRecord.created_at,
      updatedAt: userRecord.updated_at,
    });
    expect(setup.calls[0]?.url).toBe(
      'https://project.supabase.co/rest/v1/users',
    );
    expect(setup.calls[0]?.init?.method).toBe('POST');
    expect(new Headers(setup.calls[0]?.init?.headers).get('apikey')).toBe(
      'service-role-key',
    );
    expect(setup.calls[0]?.init?.body).toBe(
      JSON.stringify({
        username: 'member',
        email: 'member@example.com',
        password_hash: 'scrypt-hash',
      }),
    );
  });

  it('translates the unique-constraint response into a duplicate error', async () => {
    const setup: Fixture = fixture(
      Response.json({ code: '23505' }, { status: 409 }),
    );

    await expect(
      setup.repository.create({
        username: 'member',
        email: 'member@example.com',
        passwordHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(DuplicateUserError);
  });

  it('reports non-unique database request failures', async () => {
    const setup: Fixture = fixture(
      Response.json({ code: '42501' }, { status: 500 }),
    );

    await expect(
      setup.repository.findById('user-123'),
    ).rejects.toBeInstanceOf(UserRepositoryError);
  });

  it('rejects a successful create response that has no row', async () => {
    const setup: Fixture = fixture(Response.json([]));

    await expect(
      setup.repository.create({
        username: 'member',
        email: 'member@example.com',
        passwordHash: 'hash',
      }),
    ).rejects.toThrow('Supabase did not return the created user.');
  });

  it('finds by email with an encoded PostgREST filter', async () => {
    const setup: Fixture = fixture();

    await expect(
      setup.repository.findByEmail('member+tag@example.com'),
    ).resolves.toMatchObject({ id: 'user-123' });
    expect(setup.calls[0]?.url).toContain(
      'email=eq.member%2Btag%40example.com',
    );
    expect(setup.calls[0]?.url).toContain('limit=1');
  });

  it('returns null when an email does not exist', async () => {
    const setup: Fixture = fixture(Response.json([]));
    await expect(
      setup.repository.findByEmail('missing@example.com'),
    ).resolves.toBeNull();
  });

  it('treats a no-content lookup response as no matching user', async () => {
    const repository: SupabaseUserRepository = new SupabaseUserRepository(
      'https://project.supabase.co',
      { request: () => Promise.resolve(null) },
    );

    await expect(repository.findById('missing')).resolves.toBeNull();
  });

  it('finds by user id', async () => {
    const setup: Fixture = fixture();
    await expect(
      setup.repository.findById('user-123'),
    ).resolves.toMatchObject({ id: 'user-123' });
    expect(setup.calls[0]?.url).toContain('id=eq.user-123');
  });

  it('returns null when a user id does not exist', async () => {
    const setup: Fixture = fixture(Response.json([]));
    await expect(
      setup.repository.findById('missing'),
    ).resolves.toBeNull();
  });

  it('updates a username', async () => {
    const setup: Fixture = fixture(
      Response.json([{ ...userRecord, username: 'new-name' }]),
    );

    await expect(
      setup.repository.updateUsername('user-123', 'new-name'),
    ).resolves.toMatchObject({ username: 'new-name' });
    expect(setup.calls[0]?.init?.method).toBe('PATCH');
    expect(setup.calls[0]?.init?.body).toBe(JSON.stringify({ username: 'new-name' }));
  });

  it('returns null when username update affects no user', async () => {
    const setup: Fixture = fixture(Response.json([]));
    await expect(
      setup.repository.updateUsername('missing', 'new-name'),
    ).resolves.toBeNull();
  });

  it('updates a password hash without returning it to the route layer', async () => {
    const setup: Fixture = fixture(
      Response.json([{ ...userRecord, password_hash: 'new-scrypt-hash' }]),
    );

    await expect(
      setup.repository.updatePasswordHash('user-123', 'new-scrypt-hash'),
    ).resolves.toMatchObject({ passwordHash: 'new-scrypt-hash' });
    expect(setup.calls[0]?.init?.body).toBe(
      JSON.stringify({ password_hash: 'new-scrypt-hash' }),
    );
  });

  it('returns null when password update affects no user', async () => {
    const setup: Fixture = fixture(Response.json([]));
    await expect(
      setup.repository.updatePasswordHash('missing', 'new-hash'),
    ).resolves.toBeNull();
  });

  it('updates a profile image key', async () => {
    const setup: Fixture = fixture(
      Response.json([
        { ...userRecord, profile_image_key: 'profiles/avatar.webp' },
      ]),
    );

    await expect(
      setup.repository.updateProfileImage(
        'user-123',
        'profiles/avatar.webp',
      ),
    ).resolves.toMatchObject({
      profileImageKey: 'profiles/avatar.webp',
    });
    expect(setup.calls[0]?.init?.body).toBe(
      JSON.stringify({ profile_image_key: 'profiles/avatar.webp' }),
    );
  });

  it('returns null when profile image update affects no user', async () => {
    const setup: Fixture = fixture(Response.json([]));
    await expect(
      setup.repository.updateProfileImage('missing', 'profiles/image.png'),
    ).resolves.toBeNull();
  });

  it('deletes the user and reports whether a row was removed', async () => {
    const setup: Fixture = fixture(Response.json([userRecord]));
    await expect(setup.repository.delete('user-123')).resolves.toBe(true);
    expect(setup.calls[0]?.init?.method).toBe('DELETE');

    setup.setResponse(Response.json([]));
    await expect(setup.repository.delete('missing')).resolves.toBe(false);
  });

  it('handles a no-content response as an empty result', async () => {
    const setup: Fixture = fixture(new Response(null, { status: 204 }));

    await expect(setup.repository.delete('missing')).resolves.toBe(false);
  });

  it('rejects a successful scalar response', async () => {
    const setup: Fixture = fixture(Response.json('unexpected'));

    await expect(
      setup.repository.findById('user-123'),
    ).rejects.toBeInstanceOf(UserRepositoryError);
  });

  it('rejects a response that is not an array', async () => {
    const setup: Fixture = fixture(Response.json({ id: 'user-123' }));

    await expect(
      setup.repository.findById('user-123'),
    ).rejects.toThrow('Supabase returned an invalid user result.');
  });

  it('rejects malformed user rows', async () => {
    const setup: Fixture = fixture(Response.json([{ ...userRecord, email: 7 }]));

    await expect(
      setup.repository.findById('user-123'),
    ).rejects.toThrow('Supabase returned a malformed user record.');
  });

  it('accepts malformed non-object database error responses as request failures', async () => {
    const setup: Fixture = fixture(Response.json(['error'], { status: 500 }));

    await expect(
      setup.repository.findById('user-123'),
    ).rejects.toBeInstanceOf(UserRepositoryError);
  });

  it('propagates errors that are not Supabase REST errors', async () => {
    const repository: SupabaseUserRepository = new SupabaseUserRepository(
      'https://project.supabase.co',
      {
        request: () => Promise.reject(new Error('network failure')),
      },
    );

    await expect(repository.findById('user-123')).rejects.toThrow(
      'network failure',
    );
  });
});
