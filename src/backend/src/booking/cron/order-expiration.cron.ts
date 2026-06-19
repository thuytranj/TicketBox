import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookingService } from '../booking.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class OrderExpirationCron {
  private readonly logger = new Logger(OrderExpirationCron.name);
  private readonly LOCK_KEY = 'lock:order-expiration';
  private readonly LOCK_TTL_MS = 60000; // 60 seconds

  constructor(
    private readonly bookingService: BookingService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Backup mechanism: runs every 5 minutes to expire stale pending orders.
   * The 12-minute cutoff gives DLX primary mechanism time to fire first (10 min TTL).
   * This cron catches any orders that DLX may have missed due to failures.
   */
  @Cron('*/5 * * * *', { name: 'expire-stale-orders' })
  async handleOrderExpiration() {
    const role = process.env.INSTANCE_ROLE ?? 'all';
    const isEnabled = ['all', 'worker', 'worker:booking'].includes(role);

    if (!isEnabled) {
      return;
    }

    const lockAcquired = await this.redisService.acquireLock(
      this.LOCK_KEY,
      this.LOCK_TTL_MS,
    );
    if (!lockAcquired) {
      this.logger.log(
        'Another instance is already scanning for stale pending orders. Skipping.',
      );
      return;
    }

    this.logger.log('Cronjob: Scanning for stale pending orders...');
    try {
      const count = await this.bookingService.expireStaleOrders();
      if (count > 0) {
        this.logger.warn(`Cronjob: Expired ${count} stale order(s)`);
      } else {
        this.logger.log('Cronjob: No stale orders found');
      }
    } catch (err) {
      this.logger.error('Cronjob: Failed to expire stale orders:', err);
    } finally {
      await this.redisService.releaseLock(this.LOCK_KEY);
    }
  }
}
