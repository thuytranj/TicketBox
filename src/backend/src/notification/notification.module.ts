import { Module } from '@nestjs/common';
import { RabbitMQModule } from '../common/rabbitmq/rabbitmq.module';
import { EmailService } from './email.service';
import { NotificationConsumer } from './notification.consumer';

@Module({
  imports: [RabbitMQModule],
  providers: [EmailService, NotificationConsumer],
  exports: [EmailService],
})
export class NotificationModule {}
