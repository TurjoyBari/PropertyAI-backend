import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

@Injectable()
export class AppService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  getRoot() {
    return {
      name: 'PropertyAI API',
      status: 'ok',
      docs: 'See /health for a lightweight health check.',
    };
  }

  getHealth() {
    const dbState = this.connection.readyState;
    const dbStatus =
      dbState === ConnectionStates.connected
        ? 'connected'
        : dbState === ConnectionStates.connecting
          ? 'connecting'
          : dbState === ConnectionStates.disconnecting
            ? 'disconnecting'
            : 'disconnected';

    return {
      status: 'ok',
      service: 'propertyai-backend',
      database: {
        status: dbStatus,
        name: this.connection.name || null,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
