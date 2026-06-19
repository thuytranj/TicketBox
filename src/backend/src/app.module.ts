import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './common/redis/redis.module';
import { RabbitMQModule } from './common/rabbitmq/rabbitmq.module';
import { ormConfig } from './data/ormconfig';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './notification/notification.module';
import { ConcertModule } from './concert/concert.module';
import { AIModule } from './ai/ai.module';
import { BookingModule } from './booking/booking.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(__dirname, '../../../.env'),
        path.resolve(process.cwd(), '../../.env'),
      ],
    }),
    TypeOrmModule.forRoot(ormConfig),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        // Global default: 60 requests per minute per IP
        ttl: 60000,
        limit: 60,
      },
    ]),
    RedisModule,
    RabbitMQModule,
    AuthModule,
    NotificationModule,
    ConcertModule,
    AIModule,
    BookingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      // Apply ThrottlerGuard globally to all routes
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})

export class AppModule {}
