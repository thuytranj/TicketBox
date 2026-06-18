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

@Module({
  imports: [
    RabbitMQModule,
    TypeOrmModule.forFeature([NotificationLog]),
    AuthModule,
  ],
  controllers: [NotificationController],
  providers: [EmailService, NotificationConsumer, NotificationGateway, NotificationService],
  exports: [EmailService, TypeOrmModule, NotificationGateway, NotificationService],
})
export class NotificationModule {}
