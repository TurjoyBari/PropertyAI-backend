/**
 * Central application configuration.
 * Values are loaded from environment variables via @nestjs/config.
 * Prefer ConfigService.get('key') over reading process.env everywhere.
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  mongodbUri: process.env.MONGODB_URI,
  betterAuthSecret: process.env.BETTER_AUTH_SECRET,
  betterAuthUrl: process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  throttle: {
    /** Time window in milliseconds */
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
    /** Max requests per TTL window per IP */
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
});
