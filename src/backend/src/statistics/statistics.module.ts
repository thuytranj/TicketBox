import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { Order } from '../booking/entities/order.entity';
import { TicketType } from '../concert/entities/ticket-type.entity';
import { Concert } from '../concert/entities/concert.entity';
import { CheckinLog } from '../checkin/entities/checkin-log.entity';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, TicketType, Concert, CheckinLog]),
    RedisModule,
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
