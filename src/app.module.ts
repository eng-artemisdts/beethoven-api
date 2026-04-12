import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ArtistsModule } from './artists/artists.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { HealthController } from './health/health.controller';
import { TracksModule } from './tracks/tracks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri:
          config.get<string>('MONGODB_URI') ??
          'mongodb://127.0.0.1:27017/auris',
        ...(process.env.NODE_ENV === 'test'
          ? { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000 }
          : {}),
      }),
    }),
    // AuthModule,
    ArtistsModule,
    TracksModule,
  ],
  controllers: [HealthController],
  // providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule { }
