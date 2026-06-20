import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { AIService } from './ai.service';
import {
  ConcertAIBio,
  ConcertAIBioStatus,
} from '../concert/entities/concert-ai-bio.entity';
import { Concert } from '../concert/entities/concert.entity';
import { NotificationService } from '../notification/notification.service';
import {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
} from '../notification/entities/notification-log.entity';

@Injectable()
export class AIConsumer implements OnModuleInit {
  private readonly logger = new Logger(AIConsumer.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly aiService: AIService,
    @InjectRepository(ConcertAIBio)
    private readonly concertAIBioRepository: Repository<ConcertAIBio>,
    @InjectRepository(Concert)
    private readonly concertRepository: Repository<Concert>,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit() {
    const role = process.env.INSTANCE_ROLE ?? 'all';
    const isEnabled = ['all', 'worker', 'worker:background'].includes(role);

    if (!isEnabled) {
      this.logger.log(
        `Skipped starting AI bio queue consumer due to INSTANCE_ROLE: ${role}`,
      );
      return;
    }

    this.startConsuming().catch((err) => {
      this.logger.error('Failed to start consuming AI bio queue:', err);
    });
  }

  private async startConsuming() {
    const queue = 'ai.generate_bio';
    this.logger.log(`Starting to consume queue "${queue}"...`);

    await this.rabbitMQService.consume(queue, async (msg) => {
      if (!msg) return;

      const channel = this.rabbitMQService.getChannel();
      let content: any;
      try {
        content = JSON.parse(msg.content.toString());
      } catch (err) {
        this.logger.error('Failed to parse RabbitMQ message content:', err);
        channel.ack(msg);
        return;
      }

      const { concertId, userId, rawText } = content;
      this.logger.log(
        `Received task to generate AI bio for concert: ${concertId}`,
      );

      try {
        const concert = await this.concertRepository.findOne({
          where: { id: concertId },
        });
        if (!concert) {
          this.logger.error(`Concert with ID ${concertId} not found`);
          channel.ack(msg);
          return;
        }

        // 3-time retry logic with exponential backoff
        let retries = 0;
        const maxRetries = 3;
        let draftBio: string | null = null;
        let errorMsg: string | null = null;

        while (retries < maxRetries) {
          try {
            draftBio = await this.aiService.generateBiographySummary(rawText);
            break;
          } catch (err) {
            retries++;
            errorMsg = err.message || 'Unknown error';
            this.logger.warn(
              `Gemini API call failed (attempt ${retries}/${maxRetries}): ${errorMsg}`,
            );
            if (retries < maxRetries) {
              const delay = Math.pow(2, retries) * 1000;
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        }

        const aiBio = await this.concertAIBioRepository.findOne({
          where: { concertId },
        });
        if (!aiBio) {
          this.logger.error(
            `ConcertAIBio record for concert ID ${concertId} not found`,
          );
          channel.ack(msg);
          return;
        }

        if (draftBio) {
          // Success
          aiBio.status = ConcertAIBioStatus.COMPLETED;
          aiBio.draftBio = draftBio;
          aiBio.error = null;
          await this.concertAIBioRepository.save(aiBio);

          // Create success in-app notification
          await this.notificationService.createNotification(userId, {
            type: NotificationType.AI_BIO_COMPLETED,
            title: 'Artist biography generated successfully',
            body: `The artist biography for concert "${concert.title}" has been successfully generated as a draft. Please review and approve it.`,
            channel: NotificationChannel.IN_APP,
            status: NotificationStatus.UNREAD,
            referenceId: concertId,
          });
        } else {
          // Failure
          aiBio.status = ConcertAIBioStatus.FAILED;
          aiBio.error = errorMsg;
          await this.concertAIBioRepository.save(aiBio);

          // Create failure in-app notification
          await this.notificationService.createNotification(userId, {
            type: NotificationType.AI_BIO_FAILED,
            title: 'Artist biography generation failed',
            body: `Failed to generate artist biography for concert "${concert.title}": ${errorMsg}`,
            channel: NotificationChannel.IN_APP,
            status: NotificationStatus.UNREAD,
            referenceId: concertId,
          });
        }

        channel.ack(msg);
      } catch (error) {
        this.logger.error(
          'Error processing AI bio message from RabbitMQ:',
          error,
        );
        // nack with requeue=false to avoid infinite loop on bad messages
        channel.nack(msg, false, false);
      }
    });
  }
}
