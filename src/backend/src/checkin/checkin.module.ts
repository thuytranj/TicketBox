import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
import { CheckinSyncConsumer } from './checkin-sync.consumer';
import { CheckinLog } from './entities/checkin-log.entity';
import { Ticket } from '../booking/entities/ticket.entity';
import { VipGuest } from '../concert/entities/vip-guest.entity';
import { Concert } from '../concert/entities/concert.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CheckinLog, Ticket, VipGuest, Concert]),
  ],
  controllers: [CheckinController],
  providers: [CheckinService, CheckinSyncConsumer],
  exports: [CheckinService],
})
export class CheckinModule {}
