import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { generateUuidV7 } from '../../auth/utils/uuid';
import { Concert } from './concert.entity';
import { CheckinStatus } from '../../common/enums/checkin-status.enum';

export enum VipGuestStatus {
  RESERVED = 'reserved',
  ACTIVE = 'active',
  USED = 'used',
}

@Entity('vip_guests')
@Index(['concertId', 'email'], { unique: true })
export class VipGuest {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'concert_id' })
  concertId: string;

  @Column({ type: 'varchar', name: 'full_name', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string;

  @Column({ type: 'varchar', name: 'affiliate_company', length: 255, nullable: true })
  affiliateCompany: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', name: 'qr_code_hash', length: 500 })
  qrCodeHash: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: VipGuestStatus.ACTIVE,
  })
  status: VipGuestStatus;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'checkin_status',
    default: CheckinStatus.NOT_CHECKED_IN,
  })
  checkinStatus: CheckinStatus;

  @Column({ type: 'timestamp', name: 'checked_in_at', nullable: true })
  checkedInAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => Concert, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concert_id' })
  concert: Concert;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateUuidV7();
    }
  }
}
