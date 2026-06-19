import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationLog,
  NotificationStatus,
} from './entities/notification-log.entity';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class NotificationCleanupService {
  private readonly logger = new Logger(NotificationCleanupService.name);
  private readonly LOCK_KEY = '{notification-cleanup}:lock';
  private readonly LOCK_TTL_MS = 60000; // 60 seconds

  constructor(
    @InjectRepository(NotificationLog)
    private readonly notificationRepository: Repository<NotificationLog>,
    private readonly redisService: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldNotifications(): Promise<void> {
    const role = process.env.INSTANCE_ROLE ?? 'all';
    const isEnabled = ['all', 'worker', 'worker:background'].includes(role);

    if (!isEnabled) {
      return;
    }

    this.logger.log('Notification cleanup cron triggered.');

    const lockAcquired = await this.redisService.acquireLock(
      this.LOCK_KEY,
      this.LOCK_TTL_MS,
    );
    if (!lockAcquired) {
      this.logger.log(
        'Another instance is already running the cleanup. Skipping.',
      );
      return;
    }

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const BATCH_SIZE = 5000;
      const COOLDOWN_MS = 200;
      let totalDeleted = 0;
      let affected = 0;

      do {
        const deleteResult = await this.notificationRepository
          .createQueryBuilder()
          .delete()
          .from(NotificationLog)
          .where(
            'id IN (SELECT id FROM notification_logs WHERE status = :status AND read_at < :thirtyDaysAgo LIMIT :batchSize)',
            {
              status: NotificationStatus.READ,
              thirtyDaysAgo,
              batchSize: BATCH_SIZE,
            },
          )
          .execute();

        affected = deleteResult.affected ?? 0;
        totalDeleted += affected;

        if (affected > 0) {
          this.logger.log(
            `Deleted batch of ${affected} notification logs. Total deleted: ${totalDeleted}`,
          );
          await new Promise((resolve) => setTimeout(resolve, COOLDOWN_MS));
        }
      } while (affected === BATCH_SIZE);

      this.logger.log(
        `Notification cleanup completed. Purged ${totalDeleted} records.`,
      );
    } catch (err) {
      this.logger.error('Error during notification cleanup:', err.stack);
    } finally {
      await this.redisService.releaseLock(this.LOCK_KEY);
    }
  }
}
