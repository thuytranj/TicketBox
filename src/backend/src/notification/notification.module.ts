import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMQModule } from '../common/rabbitmq/rabbitmq.module';
import { AuthModule } from '../auth/auth.module';
import { EmailService } from './email.service';
import { NotificationConsumer } from './notification.consumer';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationCleanupService } from './notification-cleanup.service';
import { ConcertReminderScheduler } from './concert-reminder.scheduler';
import { Concert } from '../concert/entities/concert.entity';
import { Order } from '../booking/entities/order.entity';
import { Ticket } from '../booking/entities/ticket.entity';
import { User } from '../auth/entities/user.entity';
import { TicketType } from '../concert/entities/ticket-type.entity';

@Module({
  imports: [
    RabbitMQModule,
    TypeOrmModule.forFeature([
      NotificationLog,
      Concert,
      Order,
      Ticket,
      User,
      TicketType,
    ]),
    AuthModule,
  ],
  controllers: [NotificationController],
  providers: [
    EmailService,
    NotificationConsumer,
    NotificationGateway,
    NotificationService,
    NotificationCleanupService,
    ConcertReminderScheduler,
  ],
  exports: [
    EmailService,
    TypeOrmModule,
    NotificationGateway,
    NotificationService,
    NotificationCleanupService,
  ],
})
export class NotificationModule {}
