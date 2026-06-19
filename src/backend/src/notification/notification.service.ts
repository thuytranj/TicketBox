import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog, NotificationChannel, NotificationStatus } from './entities/notification-log.entity';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationLog)
    private readonly notificationLogRepository: Repository<NotificationLog>,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async createNotification(userId: string, data: Partial<NotificationLog>): Promise<NotificationLog> {
    const notification = this.notificationLogRepository.create({
      userId,
      channel: data.channel ?? NotificationChannel.IN_APP,
      status: data.status ?? NotificationStatus.UNREAD,
      type: data.type,
      title: data.title,
      body: data.body,
      referenceId: data.referenceId,
    });

    const savedNotification = await this.notificationLogRepository.save(notification);

    if (savedNotification.channel === NotificationChannel.IN_APP) {
      this.notificationGateway.sendNotificationToUser(
        userId,
        'notification_received',
        savedNotification,
      );
    }

    return savedNotification;
  }

  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: string,
  ): Promise<{
    data: NotificationLog[];
    meta: {
      totalItems: number;
      itemCount: number;
      itemsPerPage: number;
      totalPages: number;
      currentPage: number;
    };
  }> {
    const whereCondition: any = { userId, channel: NotificationChannel.IN_APP };
    if (status === NotificationStatus.READ || status === NotificationStatus.UNREAD) {
      whereCondition.status = status;
    }

    const [data, total] = await this.notificationLogRepository.findAndCount({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        totalItems: total,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }


  async markAsRead(userId: string, id: number): Promise<NotificationLog> {
    const notification = await this.notificationLogRepository.findOne({
      where: { id, userId, channel: NotificationChannel.IN_APP },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    notification.status = NotificationStatus.READ;
    notification.readAt = new Date();

    return this.notificationLogRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationLogRepository.update(
      { userId, channel: NotificationChannel.IN_APP, status: NotificationStatus.UNREAD },
      { status: NotificationStatus.READ, readAt: new Date() },
    );
  }
}
