import { S3Client } from '@aws-sdk/client-s3';
import type { Express } from 'express';
import { createApp } from './app.js';
import {
  AwsS3ObjectClient,
  R2ImageStorage,
} from './adapters/r2-image-storage.js';
import { ScryptPasswordHasher, JwtTokenService } from './adapters/security.js';
import { FetchSupabaseRestClient } from './adapters/supabase-rest-client.js';
import { SupabaseUserRepository } from './adapters/supabase-user-repository.js';
import { ThumborImageUrl } from './adapters/thumbor-image-url.js';
import { loadConfig, type AppConfig } from './config.js';
import { UserService } from './domain/users.js';

export function createDependencies(config: AppConfig): {
  users: UserService;
  tokens: JwtTokenService;
} {
  const tokens: JwtTokenService = new JwtTokenService(config.jwtSecret);
  const repository: SupabaseUserRepository = new SupabaseUserRepository(
    config.supabaseUrl,
    new FetchSupabaseRestClient(config.supabaseServiceRoleKey),
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

  return {
    users: new UserService(
      repository,
      new ScryptPasswordHasher(),
      tokens,
      images,
      imageUrls,
    ),
    tokens,
  };
}

const config: AppConfig = loadConfig(process.env);
const app: Express = createApp(createDependencies(config));

app.listen(config.port, () => {
  console.info(`Server running at http://localhost:${String(config.port)}`);
});
