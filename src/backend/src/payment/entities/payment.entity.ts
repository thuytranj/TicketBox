import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { generateUuidV7 } from '../../auth/utils/uuid';
import { Order } from '../../booking/entities/order.entity';

export enum PaymentGateway {
  MOMO = 'momo',
  VNPAY = 'vnpay',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity('payments')
export class Payment {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId: string;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'gateway',
  })
  gateway: PaymentGateway;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'transaction_id',
    nullable: true,
  })
  transactionId: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'amount',
  })
  amount: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ type: 'text', name: 'pay_url', nullable: true })
  payUrl: string;

  @Column({ type: 'jsonb', name: 'raw_response', nullable: true })
  rawResponse: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateUuidV7();
    }
  }
}
