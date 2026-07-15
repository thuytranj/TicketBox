import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  BeforeInsert,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { generateUuidV7 } from '../../auth/utils/uuid';
import { User } from '../../auth/entities/user.entity';
import { Concert } from '../../concert/entities/concert.entity';
import { Ticket } from './ticket.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

const numericTransformer = {
  to: (value: number | string) => value,
  from: (value: string) => (value ? parseFloat(value) : value),
};

@Entity('orders')
export class Order {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Index()
  @Column({ type: 'uuid', name: 'concert_id' })
  concertId: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'total_amount',
    transformer: numericTransformer,
  })
  totalAmount: number;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'idempotency_key',
    nullable: true,
    unique: true,
  })
  idempotencyKey: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Concert)
  @JoinColumn({ name: 'concert_id' })
  concert: Concert;

  @OneToMany(() => Ticket, (ticket) => ticket.order, { cascade: true })
  tickets: Ticket[];

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateUuidV7();
    }
  }
}
