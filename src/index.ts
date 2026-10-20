import { S3Client } from '@aws-sdk/client-s3';
import type { Express } from 'express';
import { createApp } from './app.js';
import {
  AwsS3ObjectClient,
  R2ImageStorage,
} from './adapters/r2-image-storage.js';
import { ScryptPasswordHasher, JwtTokenService } from './adapters/security.js';
import { SupabaseProfileImageCleanupRepository } from './adapters/supabase-profile-image-cleanup-repository.js';
import { FetchSupabaseRestClient } from './adapters/supabase-rest-client.js';
import { SupabaseUserRepository } from './adapters/supabase-user-repository.js';
import { ThumborImageUrl } from './adapters/thumbor-image-url.js';
import { loadConfig, type AppConfig } from './config.js';
import { ProfileImageCleanupService } from './domain/profile-image-cleanup.js';
import { UserService } from './domain/users.js';
import { ProfileImageCleanupWorker } from './profile-image-cleanup-worker.js';

export function createDependencies(config: AppConfig): {
  users: UserService;
  tokens: JwtTokenService;
  imageCleanupWorker: ProfileImageCleanupWorker;
} {
  const tokens: JwtTokenService = new JwtTokenService(config.jwtSecret);
  const supabaseClient: FetchSupabaseRestClient = new FetchSupabaseRestClient(
    config.supabaseServiceRoleKey,
  );
  const repository: SupabaseUserRepository = new SupabaseUserRepository(
    config.supabaseUrl,
    supabaseClient,
  );
  const imageCleanupRepository: SupabaseProfileImageCleanupRepository =
    new SupabaseProfileImageCleanupRepository(
      config.supabaseUrl,
      supabaseClient,
    );
  const s3: S3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  });
  const images: R2ImageStorage = new R2ImageStorage(
    new AwsS3ObjectClient(s3),
    config.r2Bucket,
  );
  const imageUrls: ThumborImageUrl = new ThumborImageUrl(
    config.thumborBaseUrl,
    config.r2PublicBaseUrl,
    config.thumborSecurityKey,
  );
  const imageCleanupWorker: ProfileImageCleanupWorker =
    new ProfileImageCleanupWorker(
      new ProfileImageCleanupService(
        imageCleanupRepository,
        images,
      ),
    );

  return {
    users: new UserService(
      repository,
      new ScryptPasswordHasher(),
      tokens,
      images,
      imageUrls,
      imageCleanupRepository,
    ),
    tokens,
    imageCleanupWorker,
  };
}

const config: AppConfig = loadConfig(process.env);
const dependencies: ReturnType<typeof createDependencies> =
  createDependencies(config);
const app: Express = createApp(dependencies);

app.listen(config.port, () => {
  console.info(`Server running at http://localhost:${String(config.port)}`);
});
dependencies.imageCleanupWorker.start();
