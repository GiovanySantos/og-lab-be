import express from 'express';
import type { Express } from 'express';
import { createServer, type Server } from 'node:http';

describe('application entry point', () => {
  const environmentKeys: string[] = [
    'PORT',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'R2_PUBLIC_BASE_URL',
    'THUMBOR_BASE_URL',
    'THUMBOR_SECURITY_KEY',
  ];
  const originalEnvironment: Map<string, string | undefined> = new Map(
    environmentKeys.map((key) => [key, process.env[key]]),
  );
  const portCases: ReadonlyArray<{
    label: string;
    port: string | undefined;
    expectedPort: number;
  }> = [
    { label: 'the default port', port: undefined, expectedPort: 3000 },
    { label: 'the configured port', port: '4317', expectedPort: 4317 },
  ];

  afterEach(() => {
    for (const [key, value] of originalEnvironment) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }

    jest.resetModules();
    jest.dontMock('../app.js');
    jest.restoreAllMocks();
  });

  it.each(portCases)(
    'starts the application on $label',
    ({
      port,
      expectedPort,
    }: {
      label: string;
      port: string | undefined;
      expectedPort: number;
    }) => {
      const app: Express = express();
      const listen: jest.SpyInstance<
        Server,
        Parameters<Express['listen']>
      > = jest
        .spyOn(app, 'listen')
        .mockReturnValue(createServer());
      const log: jest.SpyInstance = jest
        .spyOn(console, 'info')
        .mockImplementation(() => undefined);
      process.env['SUPABASE_URL'] = 'https://project.supabase.co';
      process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'service-role-key';
      process.env['JWT_SECRET'] = 'a-secret-with-at-least-thirty-two-bytes-long';
      process.env['R2_ACCOUNT_ID'] = 'account-id';
      process.env['R2_ACCESS_KEY_ID'] = 'access-key';
      process.env['R2_SECRET_ACCESS_KEY'] = 'secret-key';
      process.env['R2_BUCKET'] = 'profile-images';
      process.env['R2_PUBLIC_BASE_URL'] = 'https://images.example.com';
      process.env['THUMBOR_BASE_URL'] = 'https://thumbor.example';
      process.env['THUMBOR_SECURITY_KEY'] =
        'a-thumbor-secret-with-at-least-thirty-two-bytes';

      if (port === undefined) {
        delete process.env['PORT'];
      } else {
        process.env['PORT'] = port;
      }

      jest.isolateModules(() => {
        jest.doMock('../app.js', () => ({
          createApp: () => app,
        }));
        jest.requireActual('../index.js');
      });

      expect(listen).toHaveBeenCalledWith(expectedPort, expect.any(Function));

      const onListening:
        | NonNullable<Parameters<Express['listen']>[1]>
        | undefined =
        listen.mock.calls[0]?.[1];

      if (onListening !== undefined) {
        onListening();
      }

      expect(log).toHaveBeenCalledWith(
        `Server running at http://localhost:${String(expectedPort)}`,
      );
    },
  );
});
