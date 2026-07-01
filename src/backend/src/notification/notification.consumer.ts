import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { EmailService } from './email.service';
import { NotificationService } from './notification.service';
import {
  NotificationType,
  NotificationChannel,
} from './entities/notification-log.entity';

export const NOTIFICATION_EXCHANGE = 'notification.exchange';
export const INAPP_QUEUE = 'notification.inapp.queue';
export const EMAIL_QUEUE = 'notification.email.queue';
export const BOOKING_CONFIRMED_KEY = 'notification.booking.confirmed';
export const CONCERT_REMINDER_KEY = 'notification.concert.reminder';

@Injectable()
export class NotificationConsumer implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
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

    this.startTopicConsumers().catch((err) => {
      this.logger.error('Failed to start topic exchange consumers:', err);
    });
  }

  private async setupRabbitMQTopology() {
    try {
      const channel = this.rabbitMQService.getChannel();
      if (!channel) {
        this.logger.warn('RabbitMQ channel is not initialized yet in onModuleInit');
        return;
      }

      // === Existing VIP Email DLX Topology ===
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

      // === New Topic Exchange Topology ===
      // Assert Topic Exchange
      await channel.assertExchange(NOTIFICATION_EXCHANGE, 'topic', {
        durable: true,
      });

      // Assert In-app queue + bind to topic exchange
      await channel.assertQueue(INAPP_QUEUE, { durable: true });
      await channel.bindQueue(INAPP_QUEUE, NOTIFICATION_EXCHANGE, 'notification.#');

      // Assert Email queue + bind to topic exchange
      await channel.assertQueue(EMAIL_QUEUE, { durable: true });
      await channel.bindQueue(EMAIL_QUEUE, NOTIFICATION_EXCHANGE, 'notification.#');

      this.logger.log('RabbitMQ Topic Exchange topology initialized (notification.exchange → inapp + email queues)');
    } catch (error) {
      this.logger.error('Failed to initialize RabbitMQ topology', error);
    }
  }

  /**
   * Existing direct queue consumers (OTP email + VIP email)
   * Giữ nguyên để không ảnh hưởng tính năng đang hoạt động
   */
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

  /**
   * New Topic Exchange consumers for E-ticket + Concert Reminder
   */
  private async startTopicConsumers() {
    // === In-app Worker ===
    this.logger.log(`Starting to consume queue "${INAPP_QUEUE}"...`);

    await this.rabbitMQService.consume(
      INAPP_QUEUE,
      async (msg) => {
        if (!msg) return;

        const channel = this.rabbitMQService.getChannel();
        try {
          const routingKey = msg.fields.routingKey;
          const content = JSON.parse(msg.content.toString());

          this.logger.log(
            `[In-app Worker] Received message with routingKey: ${routingKey}`,
          );

          if (routingKey === BOOKING_CONFIRMED_KEY) {
            await this.handleInAppBookingConfirmed(content);
          } else if (routingKey === CONCERT_REMINDER_KEY) {
            await this.handleInAppConcertReminder(content);
          } else {
            this.logger.warn(
              `[In-app Worker] Unknown routing key: ${routingKey}. Skipping.`,
            );
          }

          channel.ack(msg);
        } catch (err) {
          this.logger.error('[In-app Worker] Error processing message:', err);
          try {
            channel.nack(msg, false, false);
          } catch (nackErr) {
            this.logger.warn('[In-app Worker] Failed to nack message');
          }
        }
      },
      { noAck: false },
    );

    // === Email Worker ===
    this.logger.log(`Starting to consume queue "${EMAIL_QUEUE}"...`);

    await this.rabbitMQService.consume(
      EMAIL_QUEUE,
      async (msg) => {
        if (!msg) return;

        const channel = this.rabbitMQService.getChannel();
        try {
          const routingKey = msg.fields.routingKey;
          const content = JSON.parse(msg.content.toString());

          this.logger.log(
            `[Email Worker] Received message with routingKey: ${routingKey}`,
          );

          if (routingKey === BOOKING_CONFIRMED_KEY) {
            await this.handleEmailBookingConfirmed(content);
          } else if (routingKey === CONCERT_REMINDER_KEY) {
            await this.handleEmailConcertReminder(content);
          } else {
            this.logger.warn(
              `[Email Worker] Unknown routing key: ${routingKey}. Skipping.`,
            );
          }

          channel.ack(msg);
        } catch (err) {
          this.logger.error('[Email Worker] Error processing message:', err);
          try {
            channel.nack(msg, false, false);
          } catch (nackErr) {
            this.logger.warn('[Email Worker] Failed to nack message');
          }
        }
      },
      { noAck: false },
    );
  }

  // ─── In-app Handlers ─────────────────────────────────────────────────────

  private async handleInAppBookingConfirmed(content: any): Promise<void> {
    const { userId, concertTitle, orderId, tickets } = content;
    const ticketCount = tickets?.length ?? 0;

    await this.notificationService.createNotification(userId, {
      type: NotificationType.BOOKING_CONFIRMED,
      channel: NotificationChannel.IN_APP,
      title: 'Booking Confirmed!',
      body: `Your booking for "${concertTitle}" has been confirmed. You have ${ticketCount} ticket(s). Check your email for your e-tickets.`,
      referenceId: orderId,
    });

    this.logger.log(
      `[In-app Worker] Created booking_confirmed notification for user ${userId}`,
    );
  }

  private async handleInAppConcertReminder(content: any): Promise<void> {
    const { userId, concertTitle, concertId, concertDate } = content;

    await this.notificationService.createNotification(userId, {
      type: NotificationType.CONCERT_REMINDER,
      channel: NotificationChannel.IN_APP,
      title: 'Concert Tomorrow!',
      body: `Reminder: "${concertTitle}" is happening on ${concertDate}. Don't forget to bring your e-ticket!`,
      referenceId: concertId,
    });

    this.logger.log(
      `[In-app Worker] Created concert_reminder notification for user ${userId}`,
    );
  }

  // ─── Email Handlers ───────────────────────────────────────────────────────

  private async handleEmailBookingConfirmed(content: any): Promise<void> {
    const {
      email,
      fullName,
      concertTitle,
      concertDate,
      concertLocation,
      tickets,
    } = content;

    this.logger.log(
      `[Email Worker] Processing e-ticket email for ${email} (${tickets?.length ?? 0} tickets)`,
    );

    // Generate QR Code PNG Buffer cho mỗi ticket
    const ticketsWithQr = await Promise.all(
      (tickets || []).map(
        async (ticket: {
          ticketId: string;
          ticketTypeName: string;
          qrCodeHash: string;
        }) => {
          const qrBuffer = await QRCode.toBuffer(ticket.qrCodeHash, {
            margin: 1,
            width: 300,
          });
          return {
            ticketId: ticket.ticketId,
            ticketTypeName: ticket.ticketTypeName,
            qrBuffer,
          };
        },
      ),
    );

    await this.emailService.sendETicketEmail(
      email,
      fullName,
      concertTitle,
      concertDate,
      concertLocation,
      ticketsWithQr,
    );

    this.logger.log(`[Email Worker] Successfully sent e-ticket email to ${email}`);
  }

  private async handleEmailConcertReminder(content: any): Promise<void> {
    const { email, fullName, concertTitle, concertDate, concertLocation } =
      content;

    this.logger.log(
      `[Email Worker] Processing concert reminder email for ${email}`,
    );

    await this.emailService.sendConcertReminderEmail(
      email,
      fullName,
      concertTitle,
      concertDate,
      concertLocation,
    );

    this.logger.log(
      `[Email Worker] Successfully sent concert reminder email to ${email}`,
    );
  }
}
