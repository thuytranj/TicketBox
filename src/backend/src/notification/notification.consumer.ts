import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
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
    const role = process.env.INSTANCE_ROLE ?? 'all';
    const isEnabled = ['all', 'worker', 'worker:background'].includes(role);

    if (!isEnabled) {
      this.logger.log(
        `Skipped starting notification consumer due to INSTANCE_ROLE: ${role}`,
      );
      return;
    }

    await this.setupRabbitMQTopology();

    this.startConsuming().catch((err) => {
      this.logger.error('Failed to start consuming OTP email queue:', err);
    });
  }

  private async setupRabbitMQTopology() {
    try {
      const channel = this.rabbitMQService.getChannel();
      if (!channel) {
        this.logger.warn('RabbitMQ channel is not initialized yet in onModuleInit');
        return;
      }

      // Assert DLX Exchange for VIP email queue
      await channel.assertExchange('notification.email.vip.dlx', 'direct', {
        durable: true,
      });

      // Assert failed/DLQ queue for VIP email queue
      await channel.assertQueue('notification.email.vip.failed', { durable: true });
      await channel.bindQueue(
        'notification.email.vip.failed',
        'notification.email.vip.dlx',
        'notification.email.vip.failed',
      );

      // Assert main VIP email queue with DLX arguments
      await channel.assertQueue('notification.email.vip', {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'notification.email.vip.dlx',
          'x-dead-letter-routing-key': 'notification.email.vip.failed',
        },
      });

      this.logger.log('RabbitMQ VIP Email topology initialized');
    } catch (error) {
      this.logger.error('Failed to initialize RabbitMQ VIP Email topology', error);
    }
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
        try {
          channel.ack(msg);
        } catch (ackErr) {
          this.logger.warn('Failed to ack OTP email message (channel might be closed)');
        }
      } catch (err) {
        this.logger.error(
          'Error processing OTP email message from RabbitMQ:',
          err,
        );

        // nack with requeue = false to discard bad messages
        const channel = this.rabbitMQService.getChannel();
        try {
          channel.nack(msg, false, false);
        } catch (nackErr) {
          this.logger.warn('Failed to nack OTP email message (channel might be closed)');
        }
      }
    });

    const vipQueue = 'notification.email.vip';
    this.logger.log(`Starting to consume queue "${vipQueue}"...`);

    await this.rabbitMQService.consume(
      vipQueue,
      async (msg) => {
        if (!msg) return;

        const channel = this.rabbitMQService.getChannel();
        try {
          const content = JSON.parse(msg.content.toString());
          const { email, fullName, concertTitle, qrCodeHash } = content;

          this.logger.log(`Received VIP email task for: ${email}`);

          // Throttling: Delay 150ms to rate limit email dispatch
          await new Promise((resolve) => setTimeout(resolve, 150));

          // Generate QR Code PNG Buffer from hash
          const qrBuffer = await QRCode.toBuffer(qrCodeHash, {
            margin: 1,
            width: 300,
          });

          await this.emailService.sendVipInvitationEmail(
            email,
            fullName,
            concertTitle,
            qrCodeHash,
            qrBuffer,
          );

          this.logger.log(`Successfully sent VIP invitation email to: ${email}`);
          try {
            channel.ack(msg);
          } catch (ackErr) {
            this.logger.warn('Failed to ack VIP email message (channel might be closed)');
          }
        } catch (err) {
          this.logger.error('Error processing VIP email message from RabbitMQ:', err);
          try {
            const content = JSON.parse(msg.content.toString());
            const { email } = content;
            const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
            if (retryCount <= 3) {
              const delay = Math.pow(2, retryCount) * 1000;
              this.logger.log(`Retrying VIP email task for ${email} (attempt ${retryCount}/3) in ${delay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
              await this.rabbitMQService.sendToQueue(vipQueue, content, {
                headers: {
                  ...msg.properties.headers,
                  'x-retry-count': retryCount,
                },
              });
              channel.ack(msg);
            } else {
              this.logger.error(`VIP email task for ${email} failed after 3 retries. Moving to DLQ.`);
              channel.nack(msg, false, false);
            }
          } catch (retryErr) {
            this.logger.error('Failed to handle retry for VIP email message:', retryErr);
            try {
              channel.nack(msg, false, false);
            } catch (nackErr) {
              this.logger.warn('Failed to nack VIP email message (channel might be closed)');
            }
          }
        }
      },
      { noAck: false },
      {
        arguments: {
          'x-dead-letter-exchange': 'notification.email.vip.dlx',
          'x-dead-letter-routing-key': 'notification.email.vip.failed',
        },
      },
    );
  }
}
