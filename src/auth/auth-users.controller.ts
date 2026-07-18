import { Controller, Get } from '@nestjs/common';
import {
  Roles,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '../common/enums';

/**
 * Demo / utility auth routes for Milestone 4.
 * Core sign-up/sign-in/reset live under Better Auth: /api/auth/*
 */
@Controller('users')
export class AuthUsersController {
  /** Current authenticated user + session (requires login). */
  @Get('me')
  getMe(@Session() session: UserSession) {
    return {
      user: session.user,
      session: {
        id: session.session.id,
        expiresAt: session.session.expiresAt,
      },
    };
  }

  /** Example RBAC route — only admin role. */
  @Get('admin-check')
  @Roles([UserRole.ADMIN])
  adminCheck(@Session() session: UserSession) {
    return {
      message: 'Admin access granted',
      userId: session.user.id,
      role: (session.user as { role?: string }).role,
    };
  }

  /** Example RBAC route — admin or agent. */
  @Get('staff-check')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  staffCheck(@Session() session: UserSession) {
    return {
      message: 'Staff access granted',
      userId: session.user.id,
      role: (session.user as { role?: string }).role,
    };
  }

  /** Public ping to confirm auth module is mounted. */
  @Get('auth-info')
  @Public()
  authInfo() {
    return {
      authBasePath: '/api/auth',
      endpoints: {
        signUp: 'POST /api/auth/sign-up/email',
        signIn: 'POST /api/auth/sign-in/email',
        signOut: 'POST /api/auth/sign-out',
        getSession: 'GET /api/auth/get-session',
        forgotPassword: 'POST /api/auth/request-password-reset',
        resetPassword: 'POST /api/auth/reset-password',
        verifyEmail: 'GET /api/auth/verify-email',
        googleSignIn: 'POST /api/auth/sign-in/social  { provider: "google" }',
        jwtToken: 'GET /api/auth/token',
        jwks: 'GET /api/auth/jwks',
      },
    };
  }
}
