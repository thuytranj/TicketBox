import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  BOOKING_CONFIRMED = 'booking_confirmed',
  CONCERT_REMINDER = 'concert_reminder',
  AI_BIO_COMPLETED = 'ai_bio_completed',
  AI_BIO_FAILED = 'ai_bio_failed',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
}

@Entity('notification_logs')
@Index(['userId', 'channel', 'createdAt'])
export class NotificationLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: NotificationChannel.IN_APP,
  })
  channel: NotificationChannel;

  @Column({
    type: 'varchar',
    length: 50,
    default: NotificationStatus.UNREAD,
  })
  status: NotificationStatus;

  @Column({ type: 'uuid', name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ type: 'timestamp', name: 'read_at', nullable: true })
  readAt: Date;

  @Column({ type: 'timestamp', name: 'sent_at', nullable: true })
  sentAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
