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

@Module({
  imports: [
    RabbitMQModule,
    TypeOrmModule.forFeature([NotificationLog]),
    AuthModule,
  ],
  controllers: [NotificationController],
  providers: [
    EmailService,
    NotificationConsumer,
    NotificationGateway,
    NotificationService,
    NotificationCleanupService,
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

