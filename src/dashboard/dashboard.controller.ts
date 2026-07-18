import { Controller, Get } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** Authenticated dashboard summary used by the frontend home screen. */
  @Get('stats')
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
