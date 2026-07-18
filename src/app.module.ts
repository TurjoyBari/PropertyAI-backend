import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { createAuth } from './auth/auth';
import { AuthFeatureModule } from './auth/auth-feature.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { PropertiesModule } from './properties/properties.module';
import { LeadsModule } from './leads/leads.module';
import { VisitsModule } from './visits/visits.module';
import { ReportsModule } from './reports/reports.module';
import { UploadsModule } from './uploads/uploads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttl', 60000),
          limit: config.get<number>('throttle.limit', 100),
        },
      ],
    }),
    AuthModule.forRootAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const auth = await createAuth({
          mongodbUri: config.getOrThrow<string>('mongodbUri'),
          secret: config.getOrThrow<string>('betterAuthSecret'),
          baseURL: config.getOrThrow<string>('betterAuthUrl'),
          frontendUrl: config.get<string>('frontendUrl', 'http://localhost:3000'),
          nodeEnv: config.get<string>('nodeEnv', 'development'),
          googleClientId: config.get<string>('googleClientId') || undefined,
          googleClientSecret: config.get<string>('googleClientSecret') || undefined,
        });

        return {
          auth,
          bodyParser: {
            json: { limit: '2mb' },
            urlencoded: { limit: '2mb', extended: true },
            rawBody: true,
          },
        };
      },
    }),
    DatabaseModule,
    UsersModule,
    PropertiesModule,
    LeadsModule,
    VisitsModule,
    ReportsModule,
    UploadsModule,
    NotificationsModule,
    AuthFeatureModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformResponseInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*path');
  }
}
