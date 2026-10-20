export type AppConfig = {
  port: number;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  jwtSecret: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  r2PublicBaseUrl: string;
  thumborBaseUrl: string;
  thumborSecurityKey: string;
};

export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const portValue: string = environment['PORT'] ?? '3000';
  const port: number = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return {
    port,
    supabaseUrl: requiredSupabaseUrl(environment),
    supabaseServiceRoleKey: requiredValue(
      environment,
      'SUPABASE_SERVICE_ROLE_KEY',
    ),
    jwtSecret: requiredValue(environment, 'JWT_SECRET'),
    r2AccountId: requiredValue(environment, 'R2_ACCOUNT_ID'),
    r2AccessKeyId: requiredValue(environment, 'R2_ACCESS_KEY_ID'),
    r2SecretAccessKey: requiredValue(environment, 'R2_SECRET_ACCESS_KEY'),
    r2Bucket: requiredValue(environment, 'R2_BUCKET'),
    r2PublicBaseUrl: requiredUrl(environment, 'R2_PUBLIC_BASE_URL'),
    thumborBaseUrl: requiredUrl(environment, 'THUMBOR_BASE_URL'),
    thumborSecurityKey: requiredValue(environment, 'THUMBOR_SECURITY_KEY'),
  };
}

function requiredValue(
  environment: NodeJS.ProcessEnv,
  name: string,
): string {
  const value: string | undefined = environment[name]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function requiredUrl(environment: NodeJS.ProcessEnv, name: string): string {
  const value: string = requiredValue(environment, name);

  try {
    const parsed: URL = new URL(value);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error();
    }

    return value.replace(/\/+$/, '');
  } catch {
    throw new Error(`${name} must be a valid HTTP or HTTPS URL.`);
  }
}

function requiredSupabaseUrl(environment: NodeJS.ProcessEnv): string {
  const value: string = requiredUrl(environment, 'SUPABASE_URL');
  const parsed: URL = new URL(value);
  const hostname: string = parsed.hostname.toLowerCase();
  const isLoopback: boolean =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]';

  if (parsed.protocol === 'http:' && !isLoopback) {
    throw new Error(
      'SUPABASE_URL must use HTTPS; HTTP is allowed only for localhost, 127.0.0.1, or ::1.',
    );
  }

  return value;
}
