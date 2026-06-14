import { Entity, PrimaryColumn, Column, CreateDateColumn, BeforeInsert, OneToMany } from 'typeorm';
import { generateUuidV7 } from '../../auth/utils/uuid';
import { TicketType } from './ticket-type.entity';

export enum ConcertStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
}

@Entity('concerts')
export class Concert {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 255 })
  location: string;

  @Column({ type: 'varchar', length: 500, name: 'poster_url', nullable: true })
  posterUrl: string;

  @Column({ type: 'varchar', length: 255, name: 'poster_public_id', nullable: true })
  posterPublicId: string;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ type: 'varchar', length: 50, array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'text', name: 'svg_stage_map', nullable: true })
  svgStageMap: string;

  @Column({ type: 'timestamp', name: 'start_time' })
  startTime: Date;

  @Column({ type: 'timestamp', name: 'end_time' })
  endTime: Date;

  @Column({
    type: 'varchar',
    length: 50,
    default: ConcertStatus.DRAFT,
  })
  status: ConcertStatus;

  @Column({ type: 'boolean', name: 'reminder_sent', default: false })
  reminderSent: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => TicketType, (ticketType) => ticketType.concert, { cascade: true })
  ticketTypes: TicketType[];

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateUuidV7();
    }
  }
}
