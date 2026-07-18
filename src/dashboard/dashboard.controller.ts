import { Controller, Get } from '@nestjs/common';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UserRole } from '../common/enums';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** Ops dashboard summary — agents and admins only. */
  @Get('stats')
  @Roles([UserRole.ADMIN, UserRole.AGENT])
  async getStats(@Session() session: UserSession) {
    const stats = await this.dashboardService.getStats();
    return {
      ...stats,
      viewer: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: (session.user as { role?: string }).role ?? 'user',
      },
    };
  }
}
