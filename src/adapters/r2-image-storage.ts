import { randomUUID } from 'node:crypto';
import {
  DeleteObjectsCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  ImageStorageError,
  type ImageContentType,
  type ImageStorage,
} from '../domain/users.js';

type S3Command =
  | PutObjectCommand
  | DeleteObjectCommand
  | ListObjectsV2Command
  | DeleteObjectsCommand;

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
  deleteObjectsByPrefix(input: {
    bucket: string;
    prefix: string;
  }): Promise<void>;
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

  public async deleteObjectsByPrefix(input: {
    bucket: string;
    prefix: string;
  }): Promise<void> {
    let continuationToken: string | undefined;

    try {
      do {
        const response: object = await this.client.send(
          new ListObjectsV2Command({
            Bucket: input.bucket,
            Prefix: input.prefix,
            ContinuationToken: continuationToken,
            MaxKeys: 1000,
          }),
        );

        if (!isListObjectsResponse(response)) {
          throw new Error('R2 returned an invalid object listing.');
        }

        const objects: Array<{ Key: string }> = (response.Contents ?? []).map(
          (item) => ({ Key: item.Key }),
        );

        if (objects.length > 0) {
          const deletion: object = await this.client.send(
            new DeleteObjectsCommand({
              Bucket: input.bucket,
              Delete: { Objects: objects, Quiet: true },
            }),
          );

          if (!isSuccessfulDeleteObjectsResponse(deletion)) {
            throw new Error('R2 could not delete every listed image.');
          }
        }

        if (response.IsTruncated === true) {
          if (response.NextContinuationToken === undefined) {
            throw new Error('R2 truncated an object listing without a cursor.');
          }
          continuationToken = response.NextContinuationToken;
        } else {
          continuationToken = undefined;
        }
      } while (continuationToken !== undefined);
    } catch (error) {
      throw new ImageStorageError(
        'R2 user image deletion failed.',
        { cause: error },
      );
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
    userId: string,
    image: Buffer,
    contentType: ImageContentType,
  ): Promise<string> {
    const key: string = `users/${userId}/images/${randomUUID()}.${fileExtensions[contentType]}`;
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

  public async deleteUserImages(userId: string): Promise<void> {
    await this.client.deleteObjectsByPrefix({
      bucket: this.bucket,
      prefix: `users/${userId}/images/`,
    });
  }
}

type ListedObject = {
  Key: string;
};

type ListObjectsResponse = {
  Contents?: ListedObject[];
  IsTruncated?: boolean;
  NextContinuationToken?: string;
};

function isListObjectsResponse(value: object): value is ListObjectsResponse {
  const contentsAreValid: boolean =
    !('Contents' in value) ||
    value.Contents === undefined ||
    (Array.isArray(value.Contents) &&
      value.Contents.every(
      (
        item: object | string | number | boolean | null | undefined,
      ) =>
        typeof item === 'object' &&
        item !== null &&
        isListedObject(item),
      ));
  const truncationFlagIsValid: boolean =
    !('IsTruncated' in value) ||
    value.IsTruncated === undefined ||
    typeof value.IsTruncated === 'boolean';
  const continuationTokenIsValid: boolean =
    !('NextContinuationToken' in value) ||
    value.NextContinuationToken === undefined ||
    typeof value.NextContinuationToken === 'string';

  return (
    contentsAreValid &&
    truncationFlagIsValid &&
    continuationTokenIsValid
  );
}

function isListedObject(value: object): value is ListedObject {
  return 'Key' in value && typeof value.Key === 'string';
}

function isSuccessfulDeleteObjectsResponse(value: object): boolean {
  return (
    !('Errors' in value) ||
    value.Errors === undefined ||
    (Array.isArray(value.Errors) && value.Errors.length === 0)
  );
}
