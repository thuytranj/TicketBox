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

export enum VipGuestImportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('vip_guest_imports')
@Index(['concertId', 'createdAt'])
export class VipGuestImport {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'concert_id' })
  concertId: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: VipGuestImportStatus.PENDING,
  })
  status: VipGuestImportStatus;

  @Column({ type: 'integer', name: 'total_rows', default: 0 })
  totalRows: number;

  @Column({ type: 'integer', name: 'imported_rows', default: 0 })
  importedRows: number;

  @Column({ type: 'jsonb', name: 'error_logs', nullable: true })
  errorLogs: Array<{ row: number; email?: string; reason: string }> | null;

  @Column({ type: 'varchar', name: 'file_url', length: 1000, nullable: true })
  fileUrl: string;

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
