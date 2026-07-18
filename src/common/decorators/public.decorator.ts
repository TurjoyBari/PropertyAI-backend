import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as public for Better Auth's NestJS AuthGuard.
 * Uses the same metadata key as @thallesp/nestjs-better-auth's AllowAnonymous.
 */
export const Public = () => SetMetadata('PUBLIC', true);
