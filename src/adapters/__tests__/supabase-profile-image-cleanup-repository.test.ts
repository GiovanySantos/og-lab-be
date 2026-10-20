import { UserRepositoryError } from '../../domain/users.js';
import { SupabaseProfileImageCleanupRepository } from '../supabase-profile-image-cleanup-repository.js';

function fixture(result: object | object[] | null = []) {
  const calls: Array<{ url: URL; init: RequestInit | undefined }> = [];
  const repository: SupabaseProfileImageCleanupRepository =
    new SupabaseProfileImageCleanupRepository('https://project.supabase.co', {
      request: (url, init) => {
        calls.push({ url, init });
        return Promise.resolve(result);
      },
    });

  return { repository, calls };
}

describe('SupabaseProfileImageCleanupRepository', () => {
  it('lists pending jobs in creation order with a bounded batch size', async () => {
    const setup: ReturnType<typeof fixture> = fixture([
      {
        id: 'job-1',
        object_key: 'profiles/old.webp',
        owner_id: 'user-123',
      },
    ]);

    await expect(setup.repository.listPending()).resolves.toEqual([
      {
        id: 'job-1',
        objectKey: 'profiles/old.webp',
        userId: 'user-123',
      },
    ]);
    expect(setup.calls[0]?.url.pathname).toBe(
      '/rest/v1/profile_image_cleanup',
    );
    expect(setup.calls[0]?.url.searchParams.get('select')).toBe(
      'id,object_key,owner_id',
    );
    expect(setup.calls[0]?.url.searchParams.get('order')).toBe('created_at.asc');
    expect(setup.calls[0]?.url.searchParams.get('limit')).toBe('50');
    expect(
      setup.calls[0]?.url.searchParams.get('next_attempt_at'),
    ).toMatch(/^lte\.\d{4}-\d\d-\d\dT/);
  });

  it('lists queued historical images for one user, including delayed retries', async () => {
    const setup: ReturnType<typeof fixture> = fixture([
      {
        id: 'job-1',
        object_key: 'profiles/old.webp',
        owner_id: 'user-123',
      },
    ]);

    await expect(
      setup.repository.listPendingForUser('user-123'),
    ).resolves.toEqual([
      {
        id: 'job-1',
        objectKey: 'profiles/old.webp',
        userId: 'user-123',
      },
    ]);
    expect(setup.calls[0]?.url.searchParams.get('owner_id')).toBe(
      'eq.user-123',
    );
    expect(setup.calls[0]?.url.searchParams.has('next_attempt_at')).toBe(false);
  });

  it('rejects malformed pending-job responses', async () => {
    const setup: ReturnType<typeof fixture> = fixture([
      { id: 'job-1', object_key: 12, owner_id: 'user-123' },
    ]);

    await expect(setup.repository.listPending()).rejects.toBeInstanceOf(
      UserRepositoryError,
    );
  });

  it('rejects a cleanup job with an invalid id', async () => {
    const setup: ReturnType<typeof fixture> = fixture([
      {
        id: 12,
        object_key: 'profiles/old.webp',
        owner_id: 'user-123',
      },
    ]);

    await expect(setup.repository.listPending()).rejects.toBeInstanceOf(
      UserRepositoryError,
    );
  });

  it('rejects a non-array pending-job response', async () => {
    const setup: ReturnType<typeof fixture> = fixture({
      id: 'job-1',
      object_key: 'profiles/old.webp',
      owner_id: 'user-123',
    });

    await expect(setup.repository.listPending()).rejects.toBeInstanceOf(
      UserRepositoryError,
    );
  });

  it('deletes a completed job by id', async () => {
    const setup: ReturnType<typeof fixture> = fixture(null);

    await expect(
      setup.repository.complete('job-1'),
    ).resolves.toBeUndefined();
    expect(setup.calls[0]?.url.searchParams.get('id')).toBe('eq.job-1');
    expect(setup.calls[0]?.init?.method).toBe('DELETE');
  });

  it('reschedules a failed job for a later retry', async () => {
    const setup: ReturnType<typeof fixture> = fixture(null);
    const retryAt: string = '2026-10-20T14:30:00.000Z';

    await expect(
      setup.repository.retry('job-1', retryAt),
    ).resolves.toBeUndefined();
    expect(setup.calls[0]?.url.searchParams.get('id')).toBe('eq.job-1');
    expect(setup.calls[0]?.init?.method).toBe('PATCH');
    expect(setup.calls[0]?.init?.body).toBe(
      JSON.stringify({ next_attempt_at: retryAt }),
    );
  });

  it('wraps Supabase request failures with repository context', async () => {
    const repository: SupabaseProfileImageCleanupRepository =
      new SupabaseProfileImageCleanupRepository(
        'https://project.supabase.co',
        { request: () => Promise.reject(new Error('database unavailable')) },
      );

    await expect(repository.listPending()).rejects.toMatchObject({
      message: 'Supabase image cleanup request failed.',
      cause: new Error('database unavailable'),
    });
  });
});
