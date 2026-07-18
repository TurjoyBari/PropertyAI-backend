import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRoot() {
    return {
      name: 'PropertyAI API',
      status: 'ok',
      docs: 'See /health for a lightweight health check.',
    };
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'propertyai-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
