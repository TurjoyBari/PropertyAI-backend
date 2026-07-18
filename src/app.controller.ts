import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { AppService } from './app.service';

@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot() {
    return this.appService.getRoot();
  }

  /** Simple health check for local setup verification and future monitoring. */
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
