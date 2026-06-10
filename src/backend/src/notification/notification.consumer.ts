import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { EmailService } from './email.service';

@Injectable()
export class NotificationConsumer implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly emailService: EmailService,
  ) {}

  async onModuleInit() {
    this.startConsuming().catch((err) => {
      this.logger.error('Failed to start consuming OTP email queue:', err);
    });
  }

  private async startConsuming() {
    const queue = 'notification.email.otp';
    this.logger.log(`Starting to consume queue "${queue}"...`);

    await this.rabbitMQService.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        const { email, otp, type = 'verify' } = content;

        this.logger.log(`Received OTP task for email: ${email}, type: ${type}`);

        if (type === 'reset') {
          await this.emailService.sendResetPasswordEmail(email, otp);
        } else {
          await this.emailService.sendOtpEmail(email, otp);
        }

        this.logger.log(`Successfully sent OTP email to: ${email}`);

        const channel = this.rabbitMQService.getChannel();
        channel.ack(msg);
      } catch (err) {
        this.logger.error('Error processing OTP email message from RabbitMQ:', err);
        
        // nack with requeue = false to discard bad messages
        const channel = this.rabbitMQService.getChannel();
        channel.nack(msg, false, false);
      }
    });
  }
}
