import { Controller, Get } from '@nestjs/common';
import { Roles } from '@thallesp/nestjs-better-auth';
import { UserRole } from '../common/enums';
import { ReportsService } from './reports.service';

@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Roles([UserRole.ADMIN, UserRole.AGENT, UserRole.USER])
  getSummary() {
    return this.reportsService.getSummary();
  }
}
