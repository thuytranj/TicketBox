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
import { PaymentModule } from './payment/payment.module';
import { CheckinModule } from './checkin/checkin.module';
import { StatisticsModule } from './statistics/statistics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(__dirname, '../../../.env'),
      ],
    }),
    TypeOrmModule.forRoot(ormConfig),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: process.env.THROTTLER_TTL ? parseInt(process.env.THROTTLER_TTL, 10) : 60000,
        limit: process.env.THROTTLER_LIMIT ? parseInt(process.env.THROTTLER_LIMIT, 10) : 60,
      },
    ]),
    RedisModule,
    RabbitMQModule,
    AuthModule,
    NotificationModule,
    ConcertModule,
    AIModule,
    BookingModule,
    PaymentModule,
    CheckinModule,
    StatisticsModule,
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
