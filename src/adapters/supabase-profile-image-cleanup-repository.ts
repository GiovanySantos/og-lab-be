import type {
  PendingProfileImageCleanup,
  ProfileImageCleanupRepository,
} from '../domain/profile-image-cleanup.js';
import { UserRepositoryError } from '../domain/users.js';
import type {
  SupabaseRestClient,
  SupabaseRestResponse,
} from './supabase-rest-client.js';

const pendingBatchSize: number = 50;
type SupabaseCleanupRecord = {
  id: string;
  object_key: string;
  owner_id: string;
};

export class SupabaseProfileImageCleanupRepository
  implements ProfileImageCleanupRepository
{
  public constructor(
    private readonly projectUrl: string,
    private readonly client: SupabaseRestClient,
  ) {}

  public async listPending(): Promise<PendingProfileImageCleanup[]> {
    const url: URL = new URL(
      '/rest/v1/profile_image_cleanup',
      this.projectUrl,
    );
    url.searchParams.set('select', 'id,object_key,owner_id');
    url.searchParams.set('order', 'created_at.asc');
    url.searchParams.set('limit', String(pendingBatchSize));
    url.searchParams.set('next_attempt_at', `lte.${new Date().toISOString()}`);

    return this.pending(url);
  }

  public async listPendingForUser(
    userId: string,
  ): Promise<PendingProfileImageCleanup[]> {
    const url: URL = new URL(
      '/rest/v1/profile_image_cleanup',
      this.projectUrl,
    );
    url.searchParams.set('select', 'id,object_key,owner_id');
    url.searchParams.set('owner_id', `eq.${userId}`);
    url.searchParams.set('order', 'created_at.asc');
    url.searchParams.set('limit', String(pendingBatchSize));

    return this.pending(url);
  }

  public async complete(id: string): Promise<void> {
    const url: URL = new URL(
      '/rest/v1/profile_image_cleanup',
      this.projectUrl,
    );
    url.searchParams.set('id', `eq.${id}`);
    await this.request(url, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
  }

  public async retry(id: string, retryAt: string): Promise<void> {
    const url: URL = new URL(
      '/rest/v1/profile_image_cleanup',
      this.projectUrl,
    );
    url.searchParams.set('id', `eq.${id}`);
    await this.request(url, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ next_attempt_at: retryAt }),
    });
  }

  private async request(
    url: URL,
    init?: RequestInit,
  ): Promise<SupabaseRestResponse> {
    try {
      return await this.client.request(url, init);
    } catch (error) {
      throw new UserRepositoryError(
        'Supabase image cleanup request failed.',
        { cause: error },
      );
    }
  }

  private async pending(url: URL): Promise<PendingProfileImageCleanup[]> {
    const result: SupabaseRestResponse = await this.request(url);

    if (!isCleanupArray(result)) {
      throw new UserRepositoryError(
        'Supabase returned an invalid image cleanup result.',
      );
    }

    return result.map(mapCleanupRecord);
  }
}

function isCleanupRecord(value: object): value is SupabaseCleanupRecord {
  if (!('id' in value) || typeof value.id !== 'string') {
    return false;
  }

  return (
    'object_key' in value &&
    typeof value.object_key === 'string' &&
    'owner_id' in value &&
    typeof value.owner_id === 'string'
  );
}

function mapCleanupRecord(
  job: SupabaseCleanupRecord,
): PendingProfileImageCleanup {
  return {
    id: job.id,
    objectKey: job.object_key,
    userId: job.owner_id,
  };
}

function isCleanupArray(
  value: SupabaseRestResponse,
): value is SupabaseCleanupRecord[] {
  return Array.isArray(value) && value.every(isCleanupRecord);
}
