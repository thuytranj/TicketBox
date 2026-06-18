import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMQModule } from '../common/rabbitmq/rabbitmq.module';
import { AIService } from './ai.service';
import { AIConsumer } from './ai.consumer';
import { ConcertAIBio } from '../concert/entities/concert-ai-bio.entity';
import { Concert } from '../concert/entities/concert.entity';
import { NotificationLog } from '../notification/entities/notification-log.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConcertAIBio, Concert, NotificationLog]),
    RabbitMQModule,
    NotificationModule,
  ],
  providers: [AIService, AIConsumer],
  exports: [AIService],
})
export class AIModule {}
