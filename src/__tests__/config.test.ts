import { loadConfig, type AppConfig } from '../config.js';

const validEnvironment: NodeJS.ProcessEnv = {
  SUPABASE_URL: 'https://project.supabase.co/',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  JWT_SECRET: 'a-secret-with-at-least-thirty-two-bytes-long',
  R2_ACCOUNT_ID: 'account-id',
  R2_ACCESS_KEY_ID: 'access-key',
  R2_SECRET_ACCESS_KEY: 'secret-key',
  R2_BUCKET: 'profile-images',
  R2_PUBLIC_BASE_URL: 'https://images.example.com/',
  THUMBOR_BASE_URL: 'https://thumbor.example/',
  THUMBOR_SECURITY_KEY: 'thumbor-key',
};

describe('loadConfig', () => {
  it('loads the required services and defaults to port 3000', () => {
    const config: AppConfig = loadConfig(validEnvironment);

    expect(config).toEqual<AppConfig>({
      port: 3000,
      supabaseUrl: 'https://project.supabase.co',
      supabaseServiceRoleKey: 'service-role-key',
      jwtSecret: 'a-secret-with-at-least-thirty-two-bytes-long',
      r2AccountId: 'account-id',
      r2AccessKeyId: 'access-key',
      r2SecretAccessKey: 'secret-key',
      r2Bucket: 'profile-images',
      r2PublicBaseUrl: 'https://images.example.com',
      thumborBaseUrl: 'https://thumbor.example',
      thumborSecurityKey: 'thumbor-key',
    });
  });

  it('accepts a configured port', () => {
    expect(loadConfig({ ...validEnvironment, PORT: '4317' }).port).toBe(4317);
  });

  it.each([
    'http://localhost:54321/',
    'http://127.0.0.1:54321/',
    'http://[::1]:54321/',
  ])(
    'accepts local Supabase URL %s',
    (supabaseUrl: string) => {
      expect(
        loadConfig({
          ...validEnvironment,
          SUPABASE_URL: supabaseUrl,
        }).supabaseUrl,
      ).toBe(supabaseUrl.replace(/\/+$/, ''));
    },
  );

  it.each([
    'http://project.supabase.co',
    'HTTP://project.supabase.co',
  ])(
    'rejects non-loopback Supabase URL %s over HTTP',
    (supabaseUrl: string) => {
      expect(() =>
        loadConfig({
          ...validEnvironment,
          SUPABASE_URL: supabaseUrl,
        }),
      ).toThrow(
        'SUPABASE_URL must use HTTPS; HTTP is allowed only for localhost, 127.0.0.1, or ::1.',
      );
    },
  );

  it.each(['0', '65536', '1.5', 'not-a-port'])(
    'rejects invalid port %s',
    (port) => {
      expect(() =>
        loadConfig({ ...validEnvironment, PORT: port }),
      ).toThrow('PORT must be an integer between 1 and 65535.');
    },
  );

  it.each([
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'THUMBOR_SECURITY_KEY',
  ])('requires %s', (name) => {
    const environment: NodeJS.ProcessEnv = {
      ...validEnvironment,
      [name]: undefined,
    };

    expect(() => loadConfig(environment)).toThrow(`${name} is required.`);
  });

  it('rejects empty required values', () => {
    expect(() =>
      loadConfig({ ...validEnvironment, R2_BUCKET: '  ' }),
    ).toThrow('R2_BUCKET is required.');
  });

  it.each([
    { name: 'SUPABASE_URL', value: 'not-a-url' },
    { name: 'R2_PUBLIC_BASE_URL', value: 'ftp://images.example.com' },
    { name: 'THUMBOR_BASE_URL', value: 'http://[' },
  ])(
    'rejects invalid $name values',
    ({ name, value }: { name: string; value: string }) => {
    expect(() =>
      loadConfig({ ...validEnvironment, [name]: value }),
    ).toThrow(`${name} must be a valid HTTP or HTTPS URL.`);
    },
  );
});
