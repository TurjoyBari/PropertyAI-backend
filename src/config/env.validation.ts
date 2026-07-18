/**
 * Lightweight env validation at bootstrap.
 * Fails fast if required values are missing or invalid.
 */
export function validateEnv(config: Record<string, unknown>) {
  const port = Number(config.PORT ?? 4000);

  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: "${String(config.PORT)}". Expected 1–65535.`);
  }

  const nodeEnv = String(config.NODE_ENV ?? 'development');
  const allowedEnvs = ['development', 'production', 'test'];

  if (!allowedEnvs.includes(nodeEnv)) {
    throw new Error(
      `Invalid NODE_ENV: "${nodeEnv}". Expected one of: ${allowedEnvs.join(', ')}`,
    );
  }

  // Unit tests may run without a live database; e2e/dev/prod require a URI.
  if (nodeEnv !== 'test' && !config.MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is required. Copy .env.example to .env and set your Atlas/local URI.',
    );
  }

  if (nodeEnv !== 'test' && !config.BETTER_AUTH_SECRET) {
    throw new Error(
      'BETTER_AUTH_SECRET is required. Use a long random string (32+ chars).',
    );
  }

  if (
    (config.GOOGLE_CLIENT_ID && !config.GOOGLE_CLIENT_SECRET) ||
    (!config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET)
  ) {
    throw new Error(
      'Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or leave both empty.',
    );
  }

  return {
    ...config,
    PORT: port,
    NODE_ENV: nodeEnv,
    FRONTEND_URL: String(config.FRONTEND_URL ?? 'http://localhost:3000'),
    MONGODB_URI: config.MONGODB_URI
      ? String(config.MONGODB_URI)
      : undefined,
    BETTER_AUTH_SECRET: config.BETTER_AUTH_SECRET
      ? String(config.BETTER_AUTH_SECRET)
      : undefined,
    BETTER_AUTH_URL: String(config.BETTER_AUTH_URL ?? 'http://localhost:4000'),
    GOOGLE_CLIENT_ID: config.GOOGLE_CLIENT_ID
      ? String(config.GOOGLE_CLIENT_ID)
      : undefined,
    GOOGLE_CLIENT_SECRET: config.GOOGLE_CLIENT_SECRET
      ? String(config.GOOGLE_CLIENT_SECRET)
      : undefined,
    THROTTLE_TTL: Number(config.THROTTLE_TTL ?? 60000),
    THROTTLE_LIMIT: Number(config.THROTTLE_LIMIT ?? 100),
  };
}
