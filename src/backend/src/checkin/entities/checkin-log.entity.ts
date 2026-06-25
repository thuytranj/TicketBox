import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { generateUuidV7 } from '../../auth/utils/uuid';
import { Ticket } from '../../booking/entities/ticket.entity';
import { VipGuest } from '../../concert/entities/vip-guest.entity';
import { User } from '../../auth/entities/user.entity';

export enum CheckinLogStatus {
  VALID = 'valid',
  INVALIDATED_FRAUD = 'invalidated_fraud',
}

@Entity('checkin_logs')
export class CheckinLog {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'ticket_id', nullable: true })
  ticketId: string | null;

  @Column({ type: 'uuid', name: 'vip_guest_id', nullable: true })
  vipGuestId: string | null;

  @Column({ type: 'uuid', name: 'checked_by' })
  checkedBy: string;

  @Column({ type: 'timestamp', name: 'scan_time', default: () => 'now()' })
  scanTime: Date;

  @Column({ type: 'boolean', name: 'is_offline', default: false })
  isOffline: boolean;

  @Column({ type: 'varchar', length: 255, name: 'device_id' })
  deviceId: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: CheckinLogStatus.VALID,
  })
  status: CheckinLogStatus;

  @ManyToOne(() => Ticket, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @ManyToOne(() => VipGuest, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vip_guest_id' })
  vipGuest: VipGuest;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'checked_by' })
  checkedByUser: User;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateUuidV7();
    }
  }
}
