import {
  ProfileImageCleanupService,
  type PendingProfileImageCleanup,
} from '../profile-image-cleanup.js';

function fixture(
  jobs: PendingProfileImageCleanup[] = [],
  deleteImage: (key: string) => Promise<void> = () => Promise.resolve(),
  completeJob: (id: string) => Promise<void> = () => Promise.resolve(),
) {
  const cleanup: {
    listPending: jest.Mock;
    listPendingForUser: jest.Mock;
    complete: jest.Mock;
    retry: jest.Mock;
  } = {
    listPending: jest.fn(() => Promise.resolve(jobs)),
    listPendingForUser: jest.fn(() => Promise.resolve(jobs)),
    complete: jest.fn(completeJob),
    retry: jest.fn(() => Promise.resolve()),
  };
  const images: {
    store: jest.Mock;
    delete: jest.Mock;
    deleteUserImages: jest.Mock;
  } = {
    store: jest.fn(() => Promise.resolve('profiles/new.webp')),
    delete: jest.fn(deleteImage),
    deleteUserImages: jest.fn(() => Promise.resolve()),
  };

  return {
    service: new ProfileImageCleanupService(cleanup, images),
    cleanup,
    images,
  };
}

describe('ProfileImageCleanupService', () => {
  it('deletes each stored image before completing its cleanup job', async () => {
    const jobs: PendingProfileImageCleanup[] = [
      {
        id: 'job-1',
        objectKey: 'profiles/old-1.webp',
        userId: 'user-123',
      },
      {
        id: 'job-2',
        objectKey: 'profiles/old-2.webp',
        userId: 'user-123',
      },
    ];
    const setup: ReturnType<typeof fixture> = fixture(jobs);

    await expect(setup.service.processPending()).resolves.toBeUndefined();

    expect(setup.images.delete).toHaveBeenNthCalledWith(
      1,
      'profiles/old-1.webp',
    );
    expect(setup.images.delete).toHaveBeenNthCalledWith(
      2,
      'profiles/old-2.webp',
    );
    expect(setup.cleanup.complete).toHaveBeenNthCalledWith(1, 'job-1');
    expect(setup.cleanup.complete).toHaveBeenNthCalledWith(2, 'job-2');
  });

  it('does nothing when there are no pending jobs', async () => {
    const setup: ReturnType<typeof fixture> = fixture();

    await expect(setup.service.processPending()).resolves.toBeUndefined();

    expect(setup.images.delete).not.toHaveBeenCalled();
    expect(setup.cleanup.complete).not.toHaveBeenCalled();
  });

  it('retains failed jobs and continues processing later jobs', async () => {
    const jobs: PendingProfileImageCleanup[] = [
      {
        id: 'job-1',
        objectKey: 'profiles/failing.webp',
        userId: 'user-123',
      },
      {
        id: 'job-2',
        objectKey: 'profiles/healthy.webp',
        userId: 'user-123',
      },
    ];
    const setup: ReturnType<typeof fixture> = fixture(
      jobs,
      (key: string) =>
        key === 'profiles/failing.webp'
          ? Promise.reject(new Error('R2 unavailable'))
          : Promise.resolve(),
    );

    await expect(setup.service.processPending()).rejects.toMatchObject({
      message: 'One or more profile image cleanup jobs failed.',
      errors: [
        expect.objectContaining({
          message: 'Profile image cleanup job failed.',
          cause: new Error('R2 unavailable'),
        }),
      ],
    });

    expect(setup.cleanup.complete).toHaveBeenCalledTimes(1);
    expect(setup.cleanup.complete).toHaveBeenCalledWith('job-2');
    expect(setup.cleanup.retry).toHaveBeenCalledWith(
      'job-1',
      expect.any(String),
    );
  });

  it('retains a job when completing it fails after deleting its image', async () => {
    const setup: ReturnType<typeof fixture> = fixture(
      [{
        id: 'job-1',
        objectKey: 'profiles/old.webp',
        userId: 'user-123',
      }],
      () => Promise.resolve(),
      () => Promise.reject(new Error('database unavailable')),
    );

    await expect(setup.service.processPending()).rejects.toMatchObject({
      message: 'One or more profile image cleanup jobs failed.',
      errors: [
        expect.objectContaining({
          message: 'Profile image cleanup job failed.',
          cause: new Error('database unavailable'),
        }),
      ],
    });
    expect(setup.images.delete).toHaveBeenCalledWith('profiles/old.webp');
    expect(setup.cleanup.complete).toHaveBeenCalledWith('job-1');
    expect(setup.cleanup.retry).toHaveBeenCalledWith(
      'job-1',
      expect.any(String),
    );
  });

  it('surfaces failures to persist a retry time', async () => {
    const setup: ReturnType<typeof fixture> = fixture(
      [{
        id: 'job-1',
        objectKey: 'profiles/old.webp',
        userId: 'user-123',
      }],
      () => Promise.reject(new Error('R2 unavailable')),
    );
    setup.cleanup.retry.mockRejectedValue(new Error('database unavailable'));

    await expect(setup.service.processPending()).rejects.toMatchObject({
      message: 'One or more profile image cleanup jobs failed.',
      errors: [
        expect.objectContaining({
          message: 'Profile image cleanup job failed.',
          cause: new Error('R2 unavailable'),
        }),
        expect.objectContaining({
          message: 'Could not schedule profile image cleanup retry.',
          cause: new Error('database unavailable'),
        }),
      ],
    });
  });

});
