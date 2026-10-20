import { ProfileImageCleanupWorker } from '../profile-image-cleanup-worker.js';

function fixture(
  processPending: () => Promise<void> = () => Promise.resolve(),
) {
  const cleanup: {
    processPending: jest.Mock;
  } = {
    processPending: jest.fn(processPending),
  };
  const logger: {
    error: jest.Mock;
  } = {
    error: jest.fn(),
  };

  return {
    worker: new ProfileImageCleanupWorker(cleanup, logger),
    cleanup,
    logger,
  };
}

describe('ProfileImageCleanupWorker', () => {
  it('runs pending cleanup and logs no error on success', async () => {
    const setup: ReturnType<typeof fixture> = fixture();

    await setup.worker.runOnce();

    expect(setup.cleanup.processPending).toHaveBeenCalledTimes(1);
    expect(setup.logger.error).not.toHaveBeenCalled();
  });

  it('logs cleanup failures and allows a later retry', async () => {
    const setup: ReturnType<typeof fixture> = fixture(() =>
      Promise.reject(new Error('R2 unavailable')),
    );

    await setup.worker.runOnce();

    expect(setup.logger.error).toHaveBeenCalledWith(
      '[ProfileImageCleanup] Pending cleanup jobs could not be processed.',
      expect.objectContaining({
        message: 'Pending profile image cleanup failed.',
        cause: new Error('R2 unavailable'),
      }),
    );

    jest.mocked(setup.cleanup.processPending).mockResolvedValue(undefined);
    await setup.worker.runOnce();

    expect(setup.cleanup.processPending).toHaveBeenCalledTimes(2);
  });

  it('prevents overlapping cleanup runs', async () => {
    let finish: (() => void) | undefined;
    const setup: ReturnType<typeof fixture> = fixture(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );

    const firstRun: Promise<void> = setup.worker.runOnce();
    await setup.worker.runOnce();

    expect(setup.cleanup.processPending).toHaveBeenCalledTimes(1);
    if (finish !== undefined) {
      finish();
    }
    await firstRun;
  });

  it('starts an immediate run and schedules subsequent polling', async () => {
    jest.useFakeTimers();
    const setup: ReturnType<typeof fixture> = fixture();
    const timer: NodeJS.Timeout = setup.worker.start();

    await Promise.resolve();
    expect(setup.cleanup.processPending).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(setup.cleanup.processPending).toHaveBeenCalledTimes(2);

    clearInterval(timer);
    jest.useRealTimers();
  });
});
