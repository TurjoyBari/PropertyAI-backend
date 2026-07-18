import { Module } from '@nestjs/common';
import { AuthUsersController } from './auth-users.controller';

/**
 * Application auth helpers (profile + RBAC demos).
 * Better Auth itself is registered globally via AuthModule.forRootAsync in AppModule.
 */
@Module({
  controllers: [AuthUsersController],
})
export class AuthFeatureModule {}
