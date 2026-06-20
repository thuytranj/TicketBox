import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { generateUuidV7 } from '../../auth/utils/uuid';
import { Concert } from './concert.entity';

export enum TicketTypeName {
  GA = 'GA',
  SVIP = 'SVIP',
  VIP = 'VIP',
  CAT1 = 'CAT1',
  CAT2 = 'CAT2',
}

const numericTransformer = {
  to: (value: number | string) => value,
  from: (value: string) => (value ? parseFloat(value) : value),
};

@Entity('ticket_types')
export class TicketType {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'concert_id' })
  concertId: string;

  @Column({ type: 'varchar', length: 100 })
  name: TicketTypeName;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  price: number;

  @Column({ type: 'integer', name: 'total_quantity' })
  totalQuantity: number;

  @Column({ type: 'integer', name: 'available_quantity' })
  availableQuantity: number;

  @Column({ type: 'integer', name: 'max_per_user', default: 4 })
  maxPerUser: number;

  @Column({ type: 'timestamp', name: 'sale_start_time', nullable: true })
  saleStartTime: Date;

  @Column({ type: 'timestamp', name: 'sale_end_time', nullable: true })
  saleEndTime: Date;

  @ManyToOne(() => Concert, (concert) => concert.ticketTypes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'concert_id' })
  concert: Concert;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateUuidV7();
    }
    if (this.availableQuantity === undefined) {
      this.availableQuantity = this.totalQuantity;
    }
  }
}
