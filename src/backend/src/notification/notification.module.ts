import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMQModule } from '../common/rabbitmq/rabbitmq.module';
import { EmailService } from './email.service';
import { NotificationConsumer } from './notification.consumer';
import { NotificationLog } from './entities/notification-log.entity';

@Module({
  imports: [
    RabbitMQModule,
    TypeOrmModule.forFeature([NotificationLog]),
  ],
  providers: [EmailService, NotificationConsumer],
  exports: [EmailService, TypeOrmModule],
})
export class NotificationModule {}
