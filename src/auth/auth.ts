import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { admin, bearer, jwt } from 'better-auth/plugins';
import { MongoClient } from 'mongodb';
import { UserRole } from '../common/enums';

export type CreateAuthOptions = {
  mongodbUri: string;
  secret: string;
  baseURL: string;
  frontendUrl: string;
  nodeEnv: string;
  googleClientId?: string;
  googleClientSecret?: string;
};

/**
 * Builds the Better Auth instance (MongoDB + email/password + JWT + RBAC).
 * Google OAuth is enabled only when both client id and secret are present.
 */
export async function createAuth(options: CreateAuthOptions) {
  const client = new MongoClient(options.mongodbUri);
  await client.connect();
  const db = client.db();

  const socialProviders =
    options.googleClientId && options.googleClientSecret
      ? {
          google: {
            clientId: options.googleClientId,
            clientSecret: options.googleClientSecret,
          },
        }
      : undefined;

  return betterAuth({
    appName: 'PropertyAI',
    database: mongodbAdapter(db, { client }),
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: [options.frontendUrl],
    emailAndPassword: {
      enabled: true,
      // Turn on after SMTP is configured; verification emails still log in dev.
      requireEmailVerification: false,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => {
        // Milestone 4: log reset links. Replace with Email/WhatsApp provider later.
        console.log(`[PropertyAI Auth] Password reset → ${user.email}`);
        console.log(`[PropertyAI Auth] Reset URL: ${url}`);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        console.log(`[PropertyAI Auth] Verify email → ${user.email}`);
        console.log(`[PropertyAI Auth] Verify URL: ${url}`);
      },
    },
    socialProviders,
    session: {
      // Long-lived session cookie; JWT access tokens stay short-lived via jwt plugin.
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // rotate/extend session activity daily
      freshAge: 60 * 10,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    advanced: {
      useSecureCookies: options.nodeEnv === 'production',
      cookiePrefix: 'propertyai',
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: options.nodeEnv === 'production',
        path: '/',
      },
    },
    plugins: [
      // Provides user.role used by @Roles() from nestjs-better-auth
      admin({
        defaultRole: UserRole.USER,
        adminRoles: [UserRole.ADMIN],
      }),
      // Short-lived JWT access tokens + JWKS endpoint
      jwt({
        jwt: {
          expirationTime: '15m',
        },
      }),
      // Allows Authorization: Bearer <session-token> for API clients
      bearer(),
    ],
  });
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;
