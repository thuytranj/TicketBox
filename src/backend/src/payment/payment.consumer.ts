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
import { PAYMENT_SUCCESS_QUEUE } from './payment.service';

interface PaymentSuccessPayload {
  orderId: string;
  transactionId: string;
  amount: number;
  gateway: string;
}

/**
 * PaymentConsumer - Worker lắng nghe queue payment_success từ RabbitMQ
 *
 * Trách nhiệm:
 * 1. Nhận message payment thành công
 * 2. Activate tất cả Ticket của order (status → VALID)
 * 3. (TODO) Kích hoạt gửi email vé điện tử qua NotificationModule
 */
@Injectable()
export class PaymentConsumer implements OnModuleInit {
  private readonly logger = new Logger(PaymentConsumer.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
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

          // Activate tickets: RESERVED → VALID
          await this.activateTickets(payload.orderId);

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
   * Chuyển toàn bộ ticket của order từ RESERVED → VALID
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
}
