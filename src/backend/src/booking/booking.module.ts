import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { BookingConsumer } from './booking.consumer';
import { BookingDlxConsumer } from './booking-dlx.consumer';
import { OrderExpirationCron } from './cron/order-expiration.cron';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { Order } from './entities/order.entity';
import { Ticket } from './entities/ticket.entity';
import { TicketType } from '../concert/entities/ticket-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Ticket, TicketType]),
    ScheduleModule.forRoot(),
  ],
  controllers: [BookingController],
  providers: [
    BookingService,
    BookingConsumer,
    BookingDlxConsumer,
    OrderExpirationCron,
    IdempotencyInterceptor,
  ],
  exports: [BookingService],
})
export class BookingModule {}
