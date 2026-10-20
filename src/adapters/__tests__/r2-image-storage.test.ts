import {
  ImageStorageError,
  type ImageContentType,
} from '../../domain/users.js';
import {
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  AwsS3ObjectClient,
  R2ImageStorage,
  type S3CommandSender,
} from '../r2-image-storage.js';

describe('R2ImageStorage', () => {
  const contentTypes: ReadonlyArray<{
    contentType: ImageContentType;
    extension: string;
  }> = [
    { contentType: 'image/jpeg', extension: 'jpg' },
    { contentType: 'image/png', extension: 'png' },
    { contentType: 'image/webp', extension: 'webp' },
  ];

  it.each(contentTypes)(
    'stores a $contentType object in the configured bucket',
    async ({ contentType, extension }) => {
      const client = {
        putObject: jest.fn(() => Promise.resolve()),
        deleteObject: jest.fn(() => Promise.resolve()),
      };
      const storage = new R2ImageStorage(client, 'profile-images');
      const image = Buffer.from('image-data');

      const key = await storage.store(image, contentType);

      expect(key).toMatch(
        new RegExp(`^profiles/[0-9a-f-]+\\.${extension}$`),
      );
      expect(client.putObject).toHaveBeenCalledWith({
        bucket: 'profile-images',
        key,
        body: image,
        contentType,
      });
    },
  );

  it('deletes an object from the configured bucket', async () => {
    const client = {
      putObject: jest.fn(() => Promise.resolve()),
      deleteObject: jest.fn(() => Promise.resolve()),
    };
    const storage = new R2ImageStorage(client, 'profile-images');

    await expect(storage.delete('profiles/avatar.webp')).resolves.toBeUndefined();

    expect(client.deleteObject).toHaveBeenCalledWith({
      bucket: 'profile-images',
      key: 'profiles/avatar.webp',
    });
  });

  it('maps R2 object writes to S3-compatible put commands', async () => {
    const commands: Array<PutObjectCommand | DeleteObjectCommand> = [];
    const sender: S3CommandSender = {
      send: (command) => {
        commands.push(command);
        return Promise.resolve({});
      },
    };
    const client = new AwsS3ObjectClient(sender);
    const image = Buffer.from('image');

    await client.putObject({
      bucket: 'profile-images',
      key: 'profiles/avatar.webp',
      body: image,
      contentType: 'image/webp',
    });

    const command = commands[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    if (command instanceof PutObjectCommand) {
      expect(command.input).toMatchObject({
        Bucket: 'profile-images',
        Key: 'profiles/avatar.webp',
        Body: image,
        ContentType: 'image/webp',
      });
    }
  });

  it('maps R2 object deletions to S3-compatible delete commands', async () => {
    const commands: Array<PutObjectCommand | DeleteObjectCommand> = [];
    const sender: S3CommandSender = {
      send: (command) => {
        commands.push(command);
        return Promise.resolve({});
      },
    };
    const client = new AwsS3ObjectClient(sender);

    await client.deleteObject({
      bucket: 'profile-images',
      key: 'profiles/avatar.webp',
    });

    const command = commands[0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    if (command instanceof DeleteObjectCommand) {
      expect(command.input).toEqual({
        Bucket: 'profile-images',
        Key: 'profiles/avatar.webp',
      });
    }
  });

  it('wraps R2 upload failures with an explicit storage error', async () => {
    const client = new AwsS3ObjectClient({
      send: () => Promise.reject(new Error('R2 unavailable')),
    });

    const upload = client.putObject({
      bucket: 'profile-images',
      key: 'profiles/avatar.webp',
      body: Buffer.from('image'),
      contentType: 'image/webp',
    });

    await expect(upload).rejects.toBeInstanceOf(ImageStorageError);
    await expect(upload).rejects.toHaveProperty('message', 'R2 image upload failed.');
    await expect(upload).rejects.toHaveProperty(
      'cause.message',
      'R2 unavailable',
    );
  });

  it('wraps R2 deletion failures with an explicit storage error', async () => {
    const client = new AwsS3ObjectClient({
      send: () => Promise.reject(new Error('R2 unavailable')),
    });

    const deletion = client.deleteObject({
      bucket: 'profile-images',
      key: 'profiles/avatar.webp',
    });

    await expect(deletion).rejects.toBeInstanceOf(ImageStorageError);
    await expect(deletion).rejects.toHaveProperty(
      'message',
      'R2 image deletion failed.',
    );
    await expect(deletion).rejects.toHaveProperty(
      'cause.message',
      'R2 unavailable',
    );
  });
});
