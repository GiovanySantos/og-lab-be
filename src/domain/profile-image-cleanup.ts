import type { ImageStorage } from './users.js';

export type PendingProfileImageCleanup = {
  id: string;
  objectKey: string;
  userId: string;
};

export interface ProfileImageCleanupRepository {
  listPending(): Promise<PendingProfileImageCleanup[]>;
  listPendingForUser(userId: string): Promise<PendingProfileImageCleanup[]>;
  complete(id: string): Promise<void>;
  retry(id: string, retryAt: string): Promise<void>;
}

const retryDelayMilliseconds: number = 30_000;

export class ProfileImageCleanupService {
  public constructor(
    private readonly cleanup: ProfileImageCleanupRepository,
    private readonly images: ImageStorage,
  ) {}

  public async processPending(): Promise<void> {
    const pending: PendingProfileImageCleanup[] =
      await this.cleanup.listPending();
    const failures: Error[] = [];

    for (const job of pending) {
      try {
        await this.images.delete(job.objectKey);
        await this.cleanup.complete(job.id);
      } catch (error) {
        failures.push(
          new Error('Profile image cleanup job failed.', { cause: error }),
        );

        try {
          const retryAt: string = new Date(
            Date.now() + retryDelayMilliseconds,
          ).toISOString();
          await this.cleanup.retry(job.id, retryAt);
        } catch (retryError) {
          failures.push(
            new Error('Could not schedule profile image cleanup retry.', {
              cause: retryError,
            }),
          );
        }
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        'One or more profile image cleanup jobs failed.',
      );
    }
  }
}
