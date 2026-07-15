import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';
import { Concert, ConcertStatus } from '../concert/entities/concert.entity';
import { Order, OrderStatus } from '../booking/entities/order.entity';
import { Ticket, TicketStatus } from '../booking/entities/ticket.entity';
import { User } from '../auth/entities/user.entity';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { RedisService } from '../common/redis/redis.service';

export const NOTIFICATION_EXCHANGE = 'notification.exchange';
export const REMINDER_ROUTING_KEY = 'notification.concert.reminder';

@Injectable()
export class ConcertReminderScheduler {
  private readonly logger = new Logger(ConcertReminderScheduler.name);
  private readonly LOCK_KEY = '{concert-reminder}:lock';
  private readonly LOCK_TTL_MS = 60000; // 60 seconds

  constructor(
    @InjectRepository(Concert)
    private readonly concertRepo: Repository<Concert>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Cron Job: Quét mỗi 5 phút tìm concert sắp diễn ra trong 24h tới
   * Gửi thông báo nhắc nhở cho tất cả user có vé ACTIVE
   */
  @Cron('*/5 * * * *')
  async handleConcertReminder(): Promise<void> {
    const role = process.env.INSTANCE_ROLE ?? 'all';
    const isEnabled = ['all', 'worker', 'worker:background'].includes(role);

    if (!isEnabled) {
      return;
    }

    this.logger.log('Concert reminder cron triggered.');

    // Distributed lock để tránh nhiều instance chạy trùng
    const lockAcquired = await this.redisService.acquireLock(
      this.LOCK_KEY,
      this.LOCK_TTL_MS,
    );
    if (!lockAcquired) {
      this.logger.log(
        'Another instance is already running the concert reminder. Skipping.',
      );
      return;
    }

    try {
      await this.processReminders();
    } catch (err) {
      this.logger.error('Error during concert reminder processing:', err.stack);
    } finally {
      await this.redisService.releaseLock(this.LOCK_KEY);
    }
  }

  private async processReminders(): Promise<void> {
    const now = new Date();

    // Khoảng thời gian: 23h55' → 24h05' từ bây giờ (cửa sổ 10 phút, khớp với chu kỳ cron 5 phút)
    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000 + 55 * 60 * 1000);
    const to = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 5 * 60 * 1000);

    const concerts = await this.concertRepo.find({
      where: {
        startTime: Between(from, to),
        reminderSent: false,
        status: ConcertStatus.ACTIVE,
      },
    });

    if (concerts.length === 0) {
      this.logger.log('No concerts found for reminder in the next 24h window.');
      return;
    }

    this.logger.log(
      `Found ${concerts.length} concert(s) for reminder: ${concerts.map((c) => c.title).join(', ')}`,
    );

    // Đảm bảo Topic Exchange đã được assert
    const channel = this.rabbitMQService.getChannel();
    if (!channel) {
      this.logger.warn('RabbitMQ channel not available. Skipping reminders.');
      return;
    }
    await channel.assertExchange(NOTIFICATION_EXCHANGE, 'topic', {
      durable: true,
    });

    for (const concert of concerts) {
      try {
        await this.sendRemindersForConcert(concert);

        // Đánh dấu đã gửi reminder
        await this.concertRepo.update(concert.id, { reminderSent: true });
        this.logger.log(
          `Marked reminder_sent=true for concert "${concert.title}" (${concert.id})`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to process reminders for concert "${concert.title}" (${concert.id}):`,
          err.stack,
        );
      }
    }
  }

  private async sendRemindersForConcert(concert: Concert): Promise<void> {
    // Tìm tất cả user có vé ACTIVE của concert này
    // Join: tickets → orders (PAID) → users
    const usersWithTickets = await this.orderRepo
      .createQueryBuilder('order')
      .innerJoin('order.user', 'user')
      .innerJoin('order.tickets', 'ticket')
      .select('user.id', 'userId')
      .addSelect('user.email', 'email')
      .addSelect('user.fullName', 'fullName')
      .distinct(true)
      .where('order.concert_id = :concertId', { concertId: concert.id })
      .andWhere('order.status = :orderStatus', {
        orderStatus: OrderStatus.PAID,
      })
      .andWhere('ticket.status = :ticketStatus', {
        ticketStatus: TicketStatus.ACTIVE,
      })
      .getRawMany<{ userId: string; email: string; fullName: string }>();

    if (usersWithTickets.length === 0) {
      this.logger.log(
        `No users with active tickets for concert "${concert.title}". Skipping.`,
      );
      return;
    }

    this.logger.log(
      `Sending reminders to ${usersWithTickets.length} user(s) for concert "${concert.title}"`,
    );

    const concertDate = concert.startTime.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    for (const user of usersWithTickets) {
      const payload = {
        userId: user.userId,
        email: user.email,
        fullName: user.fullName,
        concertId: concert.id,
        concertTitle: concert.title,
        concertDate,
        concertLocation: concert.location,
      };

      await this.rabbitMQService.publish(
        NOTIFICATION_EXCHANGE,
        REMINDER_ROUTING_KEY,
        payload,
        { persistent: true },
      );
    }

    this.logger.log(
      `Published ${usersWithTickets.length} reminder message(s) for concert "${concert.title}"`,
    );
  }

  /**
   * Cron Job: Quét mỗi 15 phút tìm các concert đã kết thúc (endTime < NOW())
   * và chuyển đổi trạng thái của chúng từ ACTIVE sang COMPLETED, đồng thời xóa cache.
   */
  @Cron('*/15 * * * *')
  async handleConcertCompletion(): Promise<void> {
    const role = process.env.INSTANCE_ROLE ?? 'all';
    const isEnabled = ['all', 'worker', 'worker:background'].includes(role);

    if (!isEnabled) {
      return;
    }

    const lockKey = '{concert-completion}:lock';
    const lockAcquired = await this.redisService.acquireLock(lockKey, 60000);
    if (!lockAcquired) {
      return;
    }

    this.logger.log('Concert completion cron triggered.');
    try {
      const now = new Date();
      const endedConcerts = await this.concertRepo.find({
        where: {
          status: ConcertStatus.ACTIVE,
          endTime: LessThan(now),
        },
      });

      if (endedConcerts.length > 0) {
        this.logger.log(`Found ${endedConcerts.length} ended active concert(s) to complete.`);
        for (const concert of endedConcerts) {
          await this.concertRepo.update(concert.id, { status: ConcertStatus.COMPLETED });
          this.logger.log(`Transitioned concert "${concert.title}" (${concert.id}) to COMPLETED.`);

          // Invalidate Redis caches for this concert
          await this.redisService.del(`cache:concerts:${concert.id}`);
          await this.redisService.del(`cache:concerts:${concert.id}:stagemap`);
          await this.redisService.del(`cache:concerts:${concert.id}:ticket-types`);
          
          // Invalidate stats caches for this concert
          await this.redisService.del(`stats:concert:${concert.id}`);
          const statsKeys = await this.redisService.keys(`stats:concert:${concert.id}:*`);
          if (statsKeys.length > 0) {
            await this.redisService.del(...statsKeys);
          }
        }

        // Clear list cache and overview stats cache
        const listKeys = await this.redisService.keys('cache:concerts:list:default:*');
        if (listKeys.length > 0) {
          await this.redisService.del(...listKeys);
        }
        await this.redisService.del('stats:overview');
      }
    } catch (err) {
      this.logger.error('Error during concert completion processing:', err.stack);
    } finally {
      await this.redisService.releaseLock(lockKey);
    }
  }
}
