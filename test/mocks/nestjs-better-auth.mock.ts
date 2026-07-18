import { SetMetadata, createParamDecorator } from '@nestjs/common';
import { Module, DynamicModule } from '@nestjs/common';

/** Mirrors @thallesp/nestjs-better-auth AllowAnonymous metadata key. */
export const AllowAnonymous = () => SetMetadata('PUBLIC', true);
export const Public = AllowAnonymous;
export const OptionalAuth = () => SetMetadata('OPTIONAL_AUTH', true);
export const Roles = (_roles: string[]) => SetMetadata('ROLES', _roles);

export const Session = createParamDecorator(() => ({
  user: { id: 'test-user', email: 'test@example.com', role: 'user' },
  session: { id: 'test-session', expiresAt: new Date() },
}));

export type UserSession = {
  user: { id: string; email: string; role?: string };
  session: { id: string; expiresAt: Date };
};

@Module({})
export class AuthModule {
  static forRoot(): DynamicModule {
    return { module: AuthModule, global: true };
  }

  static forRootAsync(): DynamicModule {
    return { module: AuthModule, global: true };
  }
}

export class AuthService {}
export class AuthGuard {
  canActivate() {
    return true;
  }
}
