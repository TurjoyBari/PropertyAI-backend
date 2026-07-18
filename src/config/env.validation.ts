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

  return {
    ...config,
    PORT: port,
    NODE_ENV: nodeEnv,
    FRONTEND_URL: String(config.FRONTEND_URL ?? 'http://localhost:3000'),
    THROTTLE_TTL: Number(config.THROTTLE_TTL ?? 60000),
    THROTTLE_LIMIT: Number(config.THROTTLE_LIMIT ?? 100),
  };
}
