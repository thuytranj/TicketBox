import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { Concert } from './concert.entity';

export enum ConcertAIBioStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('concert_ai_bios')
export class ConcertAIBio {
  @PrimaryColumn({ type: 'uuid', name: 'concert_id' })
  concertId: string;

  @Column({ type: 'text', name: 'raw_text' })
  rawText: string;

  @Column({ type: 'text', name: 'draft_bio', nullable: true })
  draftBio: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: ConcertAIBioStatus.PROCESSING,
  })
  status: ConcertAIBioStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @OneToOne(() => Concert, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concert_id' })
  concert: Concert;
}
