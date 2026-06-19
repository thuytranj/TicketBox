import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { BookingService, BOOKING_EXPIRED_QUEUE } from './booking.service';
import { Order, OrderStatus } from './entities/order.entity';

interface ExpiryPayload {
  idempotencyKey?: string;
  userId: string;
  concertId: string;
  items: Array<{ ticketTypeId: string; quantity: number }>;
}

@Injectable()
export class BookingDlxConsumer implements OnModuleInit {
  private readonly logger = new Logger(BookingDlxConsumer.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly bookingService: BookingService,
  ) {}

  async onModuleInit() {
    this.startConsuming().catch((err) => {
      this.logger.error('Failed to start DLX booking consumer:', err);
    });
  }

  private async startConsuming() {
    this.logger.log(
      `Starting DLX consumer on queue "${BOOKING_EXPIRED_QUEUE}"...`,
    );

    await this.rabbitMQService.consume(
      BOOKING_EXPIRED_QUEUE,
      async (msg) => {
        if (!msg) return;

        const channel = this.rabbitMQService.getChannel();
        let payload: ExpiryPayload;

        try {
          payload = JSON.parse(msg.content.toString()) as ExpiryPayload;
          this.logger.log(
            `DLX: Processing expiry for user ${payload.userId}, concert ${payload.concertId}`,
          );

          // Find the order by idempotencyKey (if available)
          let order: Order | null = null;
          if (payload.idempotencyKey) {
            order = await this.orderRepo.findOne({
              where: { idempotencyKey: payload.idempotencyKey },
            });
          }

          if (!order || order.status !== OrderStatus.PENDING) {
            // Order already paid or expired – nothing to do
            this.logger.log(
              `DLX: Order for key "${payload.idempotencyKey}" is already ${order?.status ?? 'not found'}. Skipping.`,
            );
            channel.ack(msg);
            return;
          }

          // Mark order as expired in DB
          await this.orderRepo.update(order.id, { status: OrderStatus.EXPIRED });
          this.logger.log(`DLX: Order ${order.id} marked as EXPIRED`);

          // Release inventory on Redis
          await this.bookingService.releaseInventory(
            payload.concertId,
            payload.userId,
            payload.items,
          );

          channel.ack(msg);
        } catch (err) {
          this.logger.error('DLX: Error processing expiry message:', err);
          channel.nack(msg, false, false);
        }
      },
      { noAck: false },
    );
  }
}
