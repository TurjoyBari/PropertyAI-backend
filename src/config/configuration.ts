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
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  },
  throttle: {
    /** Time window in milliseconds */
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
    /** Max requests per TTL window per IP */
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
});
