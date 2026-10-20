export interface ProfileImageCleanupProcessor {
  processPending(): Promise<void>;
}

const pollingIntervalMilliseconds: number = 30_000;

export class ProfileImageCleanupWorker {
  private isRunning: boolean = false;

  public constructor(
    private readonly cleanup: ProfileImageCleanupProcessor,
    private readonly logger: Pick<Console, 'error'> = console,
  ) {}

  public start(): NodeJS.Timeout {
    void this.runOnce();
    return setInterval((): void => {
      void this.runOnce();
    }, pollingIntervalMilliseconds);
  }

  public async runOnce(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      await this.cleanup.processPending();
    } catch (error) {
      this.logger.error(
        '[ProfileImageCleanup] Pending cleanup jobs could not be processed.',
        new Error('Pending profile image cleanup failed.', { cause: error }),
      );
    } finally {
      this.isRunning = false;
    }
  }
}
