import { Controller, Get } from '@nestjs/common';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UserRole } from '../common/enums';
import { ReportsService } from './reports.service';

@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Roles([UserRole.ADMIN, UserRole.AGENT, UserRole.USER])
  getSummary(@Session() session: UserSession) {
    const role = (session.user as { role?: string }).role ?? UserRole.USER;
    return this.reportsService.getSummary({
      id: session.user.id,
      role,
    });
  }
}
