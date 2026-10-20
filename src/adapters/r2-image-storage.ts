import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  ImageStorageError,
  type ImageContentType,
  type ImageStorage,
} from '../domain/users.js';

type S3Command = PutObjectCommand | DeleteObjectCommand;

export interface S3CommandSender {
  send(command: S3Command): Promise<object>;
}

export interface R2ObjectClient {
  putObject(input: {
    bucket: string;
    key: string;
    body: Buffer;
    contentType: ImageContentType;
  }): Promise<void>;
  deleteObject(input: { bucket: string; key: string }): Promise<void>;
}

export class AwsS3ObjectClient implements R2ObjectClient {
  public constructor(private readonly client: S3CommandSender) {}

  public async putObject(input: {
    bucket: string;
    key: string;
    body: Buffer;
    contentType: ImageContentType;
  }): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    } catch (error) {
      throw new ImageStorageError('R2 image upload failed.', { cause: error });
    }
  }

  public async deleteObject(input: {
    bucket: string;
    key: string;
  }): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
        }),
      );
    } catch (error) {
      throw new ImageStorageError('R2 image deletion failed.', { cause: error });
    }
  }
}

const fileExtensions: Record<ImageContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class R2ImageStorage implements ImageStorage {
  public constructor(
    private readonly client: R2ObjectClient,
    private readonly bucket: string,
  ) {}

  public async store(
    image: Buffer,
    contentType: ImageContentType,
  ): Promise<string> {
    const key = `profiles/${randomUUID()}.${fileExtensions[contentType]}`;
    await this.client.putObject({
      bucket: this.bucket,
      key,
      body: image,
      contentType,
    });
    return key;
  }

  public async delete(key: string): Promise<void> {
    await this.client.deleteObject({ bucket: this.bucket, key });
  }
}
