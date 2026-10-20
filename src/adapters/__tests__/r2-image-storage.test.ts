import {
  ImageStorageError,
  type ImageContentType,
} from '../../domain/users.js';
import {
  DeleteObjectsCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  AwsS3ObjectClient,
  R2ImageStorage,
  type S3CommandSender,
} from '../r2-image-storage.js';

function createR2ObjectClient() {
  return {
    putObject: jest.fn(() => Promise.resolve()),
    deleteObject: jest.fn(() => Promise.resolve()),
    deleteObjectsByPrefix: jest.fn(() => Promise.resolve()),
  };
}

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
    async ({
      contentType,
      extension,
    }: {
      contentType: ImageContentType;
      extension: string;
    }) => {
      const client: ReturnType<typeof createR2ObjectClient> =
        createR2ObjectClient();
      const storage: R2ImageStorage = new R2ImageStorage(client, 'profile-images');
      const image: Buffer = Buffer.from('image-data');

      const key: string = await storage.store('user-123', image, contentType);

      expect(key).toMatch(
        new RegExp(`^users/user-123/images/[0-9a-f-]+\\.${extension}$`),
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
    const client: ReturnType<typeof createR2ObjectClient> =
      createR2ObjectClient();
    const storage: R2ImageStorage = new R2ImageStorage(client, 'profile-images');

    await expect(storage.delete('profiles/avatar.webp')).resolves.toBeUndefined();

    expect(client.deleteObject).toHaveBeenCalledWith({
      bucket: 'profile-images',
      key: 'profiles/avatar.webp',
    });
  });

  it('deletes all user images from the user-scoped object prefix', async () => {
    const client: ReturnType<typeof createR2ObjectClient> =
      createR2ObjectClient();
    const storage: R2ImageStorage = new R2ImageStorage(client, 'profile-images');

    await expect(
      storage.deleteUserImages('user-123'),
    ).resolves.toBeUndefined();

    expect(client.deleteObjectsByPrefix).toHaveBeenCalledWith({
      bucket: 'profile-images',
      prefix: 'users/user-123/images/',
    });
  });

  it('maps R2 object writes to S3-compatible put commands', async () => {
    const commands: Array<
      | PutObjectCommand
      | DeleteObjectCommand
      | ListObjectsV2Command
      | DeleteObjectsCommand
    > = [];
    const sender: S3CommandSender = {
      send: (command) => {
        commands.push(command);
        return Promise.resolve({});
      },
    };
    const client: AwsS3ObjectClient = new AwsS3ObjectClient(sender);
    const image: Buffer = Buffer.from('image');

    await client.putObject({
      bucket: 'profile-images',
      key: 'profiles/avatar.webp',
      body: image,
      contentType: 'image/webp',
    });

    const command:
      | PutObjectCommand
      | DeleteObjectCommand
      | ListObjectsV2Command
      | DeleteObjectsCommand
      | undefined = commands[0];
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
    const commands: Array<
      | PutObjectCommand
      | DeleteObjectCommand
      | ListObjectsV2Command
      | DeleteObjectsCommand
    > = [];
    const sender: S3CommandSender = {
      send: (command) => {
        commands.push(command);
        return Promise.resolve({});
      },
    };
    const client: AwsS3ObjectClient = new AwsS3ObjectClient(sender);

    await client.deleteObject({
      bucket: 'profile-images',
      key: 'profiles/avatar.webp',
    });

    const command:
      | PutObjectCommand
      | DeleteObjectCommand
      | ListObjectsV2Command
      | DeleteObjectsCommand
      | undefined = commands[0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    if (command instanceof DeleteObjectCommand) {
      expect(command.input).toEqual({
        Bucket: 'profile-images',
        Key: 'profiles/avatar.webp',
      });
    }
  });

  it('deletes every object under a user prefix across paginated listings', async () => {
    const commands: Array<
      | PutObjectCommand
      | DeleteObjectCommand
      | ListObjectsV2Command
      | DeleteObjectsCommand
    > = [];
    const responses: object[] = [
      {
        Contents: [
          { Key: 'users/user-123/images/first.webp' },
        ],
        IsTruncated: true,
        NextContinuationToken: 'page-2',
      },
      {
        Contents: [{ Key: 'users/user-123/images/second.webp' }],
        IsTruncated: false,
      },
    ];
    let responseIndex: number = 0;
    const sender: S3CommandSender = {
      send: (command) => {
        commands.push(command);
        if (command instanceof ListObjectsV2Command) {
          const response: object = responses[responseIndex] ?? {};
          responseIndex += 1;
          return Promise.resolve(response);
        }
        return Promise.resolve({ Errors: [] });
      },
    };
    const client: AwsS3ObjectClient = new AwsS3ObjectClient(sender);

    await expect(
      client.deleteObjectsByPrefix({
        bucket: 'profile-images',
        prefix: 'users/user-123/images/',
      }),
    ).resolves.toBeUndefined();

    const listCommands: ListObjectsV2Command[] = commands.filter(
      (command): command is ListObjectsV2Command =>
        command instanceof ListObjectsV2Command,
    );
    const deleteCommands: DeleteObjectsCommand[] = commands.filter(
      (command): command is DeleteObjectsCommand =>
        command instanceof DeleteObjectsCommand,
    );
    expect(listCommands).toHaveLength(2);
    expect(listCommands[0]?.input).toMatchObject({
      Bucket: 'profile-images',
      Prefix: 'users/user-123/images/',
      MaxKeys: 1000,
    });
    expect(listCommands[1]?.input.ContinuationToken).toBe('page-2');
    expect(deleteCommands).toHaveLength(2);
    expect(deleteCommands[0]?.input.Delete?.Objects).toEqual([
      { Key: 'users/user-123/images/first.webp' },
    ]);
    expect(deleteCommands[1]?.input.Delete?.Objects).toEqual([
      { Key: 'users/user-123/images/second.webp' },
    ]);
  });

  it('completes an empty user-prefix deletion without issuing a delete command', async () => {
    const commands: Array<ListObjectsV2Command | DeleteObjectsCommand> = [];
    const sender: S3CommandSender = {
      send: (command) => {
        if (
          command instanceof ListObjectsV2Command ||
          command instanceof DeleteObjectsCommand
        ) {
          commands.push(command);
        }
        return Promise.resolve({});
      },
    };

    await expect(
      new AwsS3ObjectClient(sender).deleteObjectsByPrefix({
        bucket: 'profile-images',
        prefix: 'users/user-123/images/',
      }),
    ).resolves.toBeUndefined();

    expect(commands).toHaveLength(1);
    expect(commands[0]).toBeInstanceOf(ListObjectsV2Command);
  });

  it.each([
    {
      description: 'an invalid object listing',
      responses: [{ Contents: ['invalid'] }],
    },
    {
      description: 'a listed object without a key',
      responses: [{ Contents: [{}] }],
    },
    {
      description: 'a listed object with a non-string key',
      responses: [{ Contents: [{ Key: 12 }] }],
    },
    {
      description: 'a truncated listing without a continuation token',
      responses: [{ IsTruncated: true }],
    },
    {
      description: 'an object deletion response containing errors',
      responses: [
        { Contents: [{ Key: 'users/user-123/images/image.webp' }] },
        { Errors: [{ Key: 'users/user-123/images/image.webp' }] },
      ],
    },
  ])('wraps failures for $description', async ({ responses }: {
    description: string;
    responses: object[];
  }) => {
    let responseIndex: number = 0;
    const sender: S3CommandSender = {
      send: () => {
        const response: object = responses[responseIndex] ?? {};
        responseIndex += 1;
        return Promise.resolve(response);
      },
    };

    await expect(
      new AwsS3ObjectClient(sender).deleteObjectsByPrefix({
        bucket: 'profile-images',
        prefix: 'users/user-123/images/',
      }),
    ).rejects.toBeInstanceOf(ImageStorageError);
  });

  it('wraps R2 upload failures with an explicit storage error', async () => {
    const client: AwsS3ObjectClient = new AwsS3ObjectClient({
      send: () => Promise.reject(new Error('R2 unavailable')),
    });

    const upload: Promise<void> = client.putObject({
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
    const client: AwsS3ObjectClient = new AwsS3ObjectClient({
      send: () => Promise.reject(new Error('R2 unavailable')),
    });

    const deletion: Promise<void> = client.deleteObject({
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
