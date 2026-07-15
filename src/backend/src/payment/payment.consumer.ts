import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { Order, OrderStatus } from '../booking/entities/order.entity';
import { Ticket, TicketStatus } from '../booking/entities/ticket.entity';
import { User } from '../auth/entities/user.entity';
import { Concert } from '../concert/entities/concert.entity';
import { TicketType } from '../concert/entities/ticket-type.entity';
import { PAYMENT_SUCCESS_QUEUE } from './payment.service';

interface PaymentSuccessPayload {
  orderId: string;
  transactionId: string;
  amount: number;
  gateway: string;
}

export const NOTIFICATION_EXCHANGE = 'notification.exchange';
export const BOOKING_CONFIRMED_KEY = 'notification.booking.confirmed';

/**
 * PaymentConsumer - Worker lắng nghe queue payment_success từ RabbitMQ
 *
 * Trách nhiệm:
 * 1. Nhận message payment thành công
 * 2. Activate tất cả Ticket của order (status → ACTIVE)
 * 3. Publish event notification.booking.confirmed lên Topic Exchange
 *    để gửi email e-ticket + thông báo in-app cho người dùng
 */
@Injectable()
export class PaymentConsumer implements OnModuleInit {
  private readonly logger = new Logger(PaymentConsumer.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Concert)
    private readonly concertRepo: Repository<Concert>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepo: Repository<TicketType>,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit() {
    const role = process.env.INSTANCE_ROLE ?? 'all';
    const isEnabled = ['all', 'worker', 'worker:booking', 'worker:background'].includes(role);

    if (!isEnabled) {
      this.logger.log(
        `PaymentConsumer skipped due to INSTANCE_ROLE: ${role}`,
      );
      return;
    }

    // Ensure Topic Exchange exists
    try {
      const channel = this.rabbitMQService.getChannel();
      if (channel) {
        await channel.assertExchange(NOTIFICATION_EXCHANGE, 'topic', {
          durable: true,
        });
      }
    } catch (err) {
      this.logger.warn('Could not assert notification exchange on init:', err.message);
    }

    await this.startConsuming();
  }

  private async startConsuming() {
    this.logger.log(`Starting to consume queue "${PAYMENT_SUCCESS_QUEUE}"...`);

    await this.rabbitMQService.consume(
      PAYMENT_SUCCESS_QUEUE,
      async (msg) => {
        if (!msg) return;

        const channel = this.rabbitMQService.getChannel();
        let payload: PaymentSuccessPayload;

        try {
          payload = JSON.parse(msg.content.toString()) as PaymentSuccessPayload;
          this.logger.log(
            `Processing payment success for order ${payload.orderId} via ${payload.gateway}`,
          );

          // Activate tickets: RESERVED → ACTIVE
          await this.activateTickets(payload.orderId);

          // Publish notification event cho e-ticket email + in-app
          await this.publishBookingConfirmedEvent(payload.orderId);

          channel.ack(msg);
          this.logger.log(`Order ${payload.orderId} fully activated.`);
        } catch (err) {
          this.logger.error('Error processing payment success event:', err);
          // nack mà không requeue để tránh vòng lặp vô hạn
          channel.nack(msg, false, false);
        }
      },
      { noAck: false },
    );
  }

  /**
   * Chuyển toàn bộ ticket của order từ RESERVED → ACTIVE
   */
  private async activateTickets(orderId: string): Promise<void> {
    const tickets = await this.ticketRepo.find({ where: { orderId } });

    if (tickets.length === 0) {
      this.logger.warn(`No tickets found for order ${orderId}`);
      return;
    }

    await this.ticketRepo.update(
      { orderId },
      { status: TicketStatus.ACTIVE },
    );

    this.logger.log(
      `Activated ${tickets.length} ticket(s) for order ${orderId}`,
    );
  }

  /**
   * Publish event notification.booking.confirmed lên Topic Exchange
   * để NotificationConsumer xử lý gửi email e-ticket + thông báo in-app
   */
  private async publishBookingConfirmedEvent(orderId: string): Promise<void> {
    try {
      // Query thông tin đầy đủ: Order → User, Concert, Tickets → TicketType
      const order = await this.orderRepo.findOne({
        where: { id: orderId },
        relations: ['user', 'concert', 'tickets'],
      });

      if (!order || !order.user || !order.concert) {
        this.logger.warn(
          `Cannot publish booking confirmed event: missing data for order ${orderId}`,
        );
        return;
      }

      // Load ticket type names cho mỗi ticket
      const ticketsWithTypes = await Promise.all(
        order.tickets.map(async (ticket) => {
          const ticketType = await this.ticketTypeRepo.findOne({
            where: { id: ticket.ticketTypeId },
          });
          return {
            ticketId: ticket.id,
            ticketTypeName: ticketType?.name ?? 'Unknown',
            qrCodeHash: ticket.qrCodeHash,
          };
        }),
      );

      const concertDate = order.concert.startTime.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'full',
        timeStyle: 'short',
      });

      const notificationPayload = {
        userId: order.userId,
        email: order.user.email,
        fullName: order.user.fullName,
        orderId: order.id,
        concertTitle: order.concert.title,
        concertDate,
        concertLocation: order.concert.location,
        tickets: ticketsWithTypes,
      };

      await this.rabbitMQService.publish(
        NOTIFICATION_EXCHANGE,
        BOOKING_CONFIRMED_KEY,
        notificationPayload,
        { persistent: true },
      );

      this.logger.log(
        `Published booking_confirmed event for order ${orderId} (${ticketsWithTypes.length} tickets) to user ${order.user.email}`,
      );
    } catch (err) {
      // Log error nhưng không throw - việc gửi notification không nên block activate ticket
      this.logger.error(
        `Failed to publish booking confirmed notification for order ${orderId}:`,
        err,
      );
    }
  }
}
