import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

/**
 * Central database connection module.
 * Feature modules import their own MongooseModule.forFeature(...) schemas.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('mongodbUri'),
        // Fail fast in production if the cluster is unreachable during boot.
        serverSelectionTimeoutMS: 10_000,
      }),
    }),
  ],
})
export class DatabaseModule {}
