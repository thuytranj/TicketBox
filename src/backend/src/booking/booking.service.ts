import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { RedisService } from '../common/redis/redis.service';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { TicketType } from '../concert/entities/ticket-type.entity';
import { generateUuidV7 } from '../auth/utils/uuid';

export const BOOKING_QUEUE = 'booking_tasks';
export const BOOKING_DELAY_QUEUE = 'booking_delay_queue';
export const BOOKING_DLX_EXCHANGE = 'booking_dlx';
export const BOOKING_EXPIRED_QUEUE = 'booking_expired_tasks';
export const ORDER_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Redis result codes from Lua script
const LUA_SUCCESS = 0;
const LUA_INSUFFICIENT_STOCK = -1;
const LUA_EXCEEDS_USER_LIMIT = -2;

@Injectable()
export class BookingService implements OnModuleInit {
  private readonly logger = new Logger(BookingService.name);
  private reserveScript: string;
  private releaseScript: string;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepo: Repository<TicketType>,
    private readonly redisService: RedisService,
    private readonly rabbitMQService: RabbitMQService,
  ) {
    this.reserveScript = readFileSync(
      join(__dirname, 'scripts', 'reserve-ticket.lua'),
      'utf8',
    );
    this.releaseScript = readFileSync(
      join(__dirname, 'scripts', 'release-ticket.lua'),
      'utf8',
    );
  }

  async onModuleInit() {
    await this.setupRabbitMQTopology();
  }

  /**
   * Setup RabbitMQ DLX topology for order expiration
   * booking_delay_queue: messages sit here with TTL=10min
   * When TTL expires -> routed to booking_dlx exchange -> booking_expired_tasks queue
   */
  private async setupRabbitMQTopology() {
    const channel = this.rabbitMQService.getChannel();

    // Dead Letter Exchange
    await channel.assertExchange(BOOKING_DLX_EXCHANGE, 'direct', {
      durable: true,
    });

    // Queue that receives expired messages from DLX
    await channel.assertQueue(BOOKING_EXPIRED_QUEUE, { durable: true });
    await channel.bindQueue(
      BOOKING_EXPIRED_QUEUE,
      BOOKING_DLX_EXCHANGE,
      BOOKING_EXPIRED_QUEUE,
    );

    // Delay queue with TTL -> DLX routing
    await channel.assertQueue(BOOKING_DELAY_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': BOOKING_DLX_EXCHANGE,
        'x-dead-letter-routing-key': BOOKING_EXPIRED_QUEUE,
        'x-message-ttl': ORDER_EXPIRY_MS,
      },
    });

    // Main booking tasks queue
    await channel.assertQueue(BOOKING_QUEUE, { durable: true });

    this.logger.log(
      'RabbitMQ booking topology initialized (DLX + delay queue)',
    );
  }

  /**
   * Main booking flow:
   * 1. Validate ticket types
   * 2. Run Redis Lua Script (atomic inventory check)
   * 3. Push to RabbitMQ for async DB write
   * 4. Push a TTL message for order expiry tracking
   */
  async createBooking(
    dto: CreateBookingDto,
    userId: string,
    idempotencyKey?: string,
  ) {
    // Fetch ticket types for validation and price calculation
    const ticketTypes = await this.fetchAndValidateTicketTypes(dto);

    // Calculate total amount
    const totalAmount = this.calculateTotal(dto, ticketTypes);

    // Run Redis Lua Script atomically for each ticket type
    const reservedItems: Array<{ ticketTypeId: string; quantity: number }> = [];
    try {
      for (const item of dto.items) {
        const tt = ticketTypes.get(item.ticketTypeId)!;
        const result = await this.runReserveLuaScript(
          dto.concertId,
          item.ticketTypeId,
          userId,
          item.quantity,
          tt.maxPerUser,
        );

        if (result === LUA_INSUFFICIENT_STOCK) {
          throw new BadRequestException(
            `Not enough tickets available for ticket type: ${tt.name}`,
          );
        }
        if (result === LUA_EXCEEDS_USER_LIMIT) {
          throw new BadRequestException(
            `Purchase limit exceeded for ticket type: ${tt.name} (max ${tt.maxPerUser} per account)`,
          );
        }

        reservedItems.push({
          ticketTypeId: item.ticketTypeId,
          quantity: item.quantity,
        });
      }
    } catch (err) {
      // Rollback any already-reserved items if one fails
      await this.rollbackReservations(dto.concertId, userId, reservedItems);
      throw err;
    }

    // Generate Order ID upfront
    const orderId = generateUuidV7();

    // Build order payload for RabbitMQ consumer
    const orderPayload = {
      id: orderId,
      userId,
      concertId: dto.concertId,
      totalAmount,
      idempotencyKey,
      items: dto.items,
    };

    // Push to booking_tasks queue (async DB write)
    await this.rabbitMQService.sendToQueue(BOOKING_QUEUE, orderPayload, {
      persistent: true,
    });

    // Push to delay queue for TTL-based expiry (DLX Primary mechanism)
    // We store orderId placeholder here; consumer will link by idempotencyKey
    const channel = this.rabbitMQService.getChannel();
    channel.sendToQueue(
      BOOKING_DELAY_QUEUE,
      Buffer.from(
        JSON.stringify({
          idempotencyKey,
          userId,
          concertId: dto.concertId,
          items: dto.items,
        }),
      ),
      { persistent: true },
    );

    this.logger.log(
      `Booking queued for user ${userId}, concert ${dto.concertId}`,
    );

    return {
      message: 'Booking is being processed. Please wait for confirmation.',
      status: 'pending',
      orderId,
      totalAmount,
    };
  }

  /**
   * Fetch booking details by ID
   */
  async getBookingById(id: string, userId: string) {
    const order = await this.orderRepo.findOne({
      where: { id, userId },
      relations: ['tickets', 'tickets.ticketType', 'concert'],
    });

    if (!order) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    return order;
  }

  /**
   * Release ticket inventory on Redis when order expires.
   * Called by DLX consumer and Cronjob.
   */
  async releaseInventory(
    concertId: string,
    userId: string,
    items: Array<{ ticketTypeId: string; quantity: number }>,
  ) {
    for (const item of items) {
      const stockKey = this.stockKey(concertId, item.ticketTypeId);
      const userBoughtKey = this.userBoughtKey(
        concertId,
        userId,
        item.ticketTypeId,
      );
      await this.redisService.eval(
        this.releaseScript,
        2,
        stockKey,
        userBoughtKey,
        String(item.quantity),
      );
    }
    this.logger.log(
      `Released inventory for user ${userId}, concert ${concertId}`,
    );
  }

  /**
   * Expire pending orders older than ORDER_EXPIRY_MS (used by Cronjob backup).
   */
  async expireStaleOrders(): Promise<number> {
    const cutoff = new Date(Date.now() - ORDER_EXPIRY_MS - 2 * 60 * 1000); // +2min buffer
    const staleOrders = await this.orderRepo.find({
      where: { status: OrderStatus.PENDING, createdAt: LessThan(cutoff) },
      relations: ['tickets', 'tickets.ticketType'],
    });

    if (staleOrders.length === 0) return 0;

    let expiredCount = 0;
    for (const order of staleOrders) {
      try {
        // Build items list from tickets
        const itemsMap = new Map<string, number>();
        for (const ticket of order.tickets) {
          const prev = itemsMap.get(ticket.ticketTypeId) ?? 0;
          itemsMap.set(ticket.ticketTypeId, prev + 1);
        }
        const items = Array.from(itemsMap.entries()).map(
          ([ticketTypeId, quantity]) => ({
            ticketTypeId,
            quantity,
          }),
        );

        // Update DB status
        await this.orderRepo.update(order.id, { status: OrderStatus.EXPIRED });

        // Release inventory on Redis
        await this.releaseInventory(order.concertId, order.userId, items);
        expiredCount++;
      } catch (err) {
        this.logger.error(`Failed to expire order ${order.id}:`, err);
      }
    }

    this.logger.log(`Cronjob expired ${expiredCount} stale orders`);
    return expiredCount;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private async fetchAndValidateTicketTypes(dto: CreateBookingDto) {
    const ticketTypeIds = dto.items.map((i) => i.ticketTypeId);
    const types = await this.ticketTypeRepo.findByIds(ticketTypeIds);

    const map = new Map<string, TicketType>();
    for (const tt of types) {
      if (tt.concertId !== dto.concertId) {
        throw new BadRequestException(
          `Ticket type ${tt.id} does not belong to concert ${dto.concertId}`,
        );
      }
      map.set(tt.id, tt);
    }

    if (map.size !== ticketTypeIds.length) {
      throw new NotFoundException('One or more ticket types not found');
    }

    return map;
  }

  private calculateTotal(
    dto: CreateBookingDto,
    ticketTypes: Map<string, TicketType>,
  ): number {
    return dto.items.reduce((sum, item) => {
      const tt = ticketTypes.get(item.ticketTypeId)!;
      return sum + tt.price * item.quantity;
    }, 0);
  }

  private async runReserveLuaScript(
    concertId: string,
    ticketTypeId: string,
    userId: string,
    quantity: number,
    maxPerUser: number,
  ): Promise<number> {
    const stockKey = this.stockKey(concertId, ticketTypeId);
    const userBoughtKey = this.userBoughtKey(concertId, userId, ticketTypeId);
    return this.redisService.eval(
      this.reserveScript,
      2,
      stockKey,
      userBoughtKey,
      String(quantity),
      String(maxPerUser),
    ) as Promise<number>;
  }

  private async rollbackReservations(
    concertId: string,
    userId: string,
    reservedItems: Array<{ ticketTypeId: string; quantity: number }>,
  ) {
    if (reservedItems.length === 0) return;
    await this.releaseInventory(concertId, userId, reservedItems);
    this.logger.warn(
      `Rolled back ${reservedItems.length} item(s) for user ${userId}`,
    );
  }

  stockKey(concertId: string, ticketTypeId: string) {
    return `concert:${concertId}:ticket_type:${ticketTypeId}:stock`;
  }

  userBoughtKey(concertId: string, userId: string, ticketTypeId: string) {
    return `concert:${concertId}:user:${userId}:bought:${ticketTypeId}`;
  }
}
