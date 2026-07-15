import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { Order, OrderStatus } from './entities/order.entity';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { BOOKING_QUEUE } from './booking.service';
import { generateUuidV7 } from '../auth/utils/uuid';

interface BookingTaskPayload {
  id: string;
  userId: string;
  concertId: string;
  totalAmount: number;
  idempotencyKey?: string;
  items: Array<{ ticketTypeId: string; quantity: number }>;
}

@Injectable()
export class BookingConsumer implements OnModuleInit {
  private readonly logger = new Logger(BookingConsumer.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    const role = process.env.INSTANCE_ROLE ?? 'all';
    const isEnabled = ['all', 'worker', 'worker:booking'].includes(role);

    if (!isEnabled) {
      this.logger.log(
        `Skipped starting booking consumer due to INSTANCE_ROLE: ${role}`,
      );
      return;
    }

    this.startConsuming().catch((err) => {
      this.logger.error('Failed to start booking consumer:', err);
    });
  }

  private async startConsuming() {
    this.logger.log(`Starting to consume queue "${BOOKING_QUEUE}"...`);

    await this.rabbitMQService.consume(
      BOOKING_QUEUE,
      async (msg) => {
        if (!msg) return;

        const channel = this.rabbitMQService.getChannel();
        let payload: BookingTaskPayload;

        try {
          payload = JSON.parse(msg.content.toString()) as BookingTaskPayload;
          this.logger.log(
            `Processing booking for user ${payload.userId}, concert ${payload.concertId}`,
          );

          // Use a DB transaction to ensure atomicity when saving Order + Tickets
          await this.dataSource.transaction(async (manager) => {
            // Create Order
            const order = manager.create(Order, {
              id: payload.id,
              userId: payload.userId,
              concertId: payload.concertId,
              totalAmount: payload.totalAmount,
              status: OrderStatus.PENDING,
              idempotencyKey: payload.idempotencyKey,
            });
            await manager.save(Order, order);

            // Create individual Ticket records
            const tickets: Ticket[] = [];
            for (const item of payload.items) {
              for (let i = 0; i < item.quantity; i++) {
                const ticket = manager.create(Ticket, {
                  orderId: order.id,
                  ticketTypeId: item.ticketTypeId,
                  status: TicketStatus.RESERVED,
                  qrCodeHash: generateUuidV7(), // placeholder QR code; replace with real QR generation
                });
                tickets.push(ticket);
              }
            }
            await manager.save(Ticket, tickets);

            this.logger.log(
              `Order ${order.id} created with ${tickets.length} ticket(s) for user ${payload.userId}`,
            );
          });

          channel.ack(msg);
        } catch (err) {
          this.logger.error('Error processing booking task:', err);
          // nack without requeue to avoid infinite loop; message goes to DLQ if configured
          channel.nack(msg, false, false);
        }
      },
      { noAck: false },
    );
  }
}
