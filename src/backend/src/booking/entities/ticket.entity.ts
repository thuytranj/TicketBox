import {
  Entity,
  PrimaryColumn,
  Column,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { generateUuidV7 } from '../../auth/utils/uuid';
import { Order } from './order.entity';
import { TicketType } from '../../concert/entities/ticket-type.entity';

export enum TicketStatus {
  RESERVED = 'reserved',
  ACTIVE = 'active',
  USED = 'used',
}

@Entity('tickets')
export class Ticket {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId: string;

  @Column({ type: 'uuid', name: 'ticket_type_id' })
  ticketTypeId: string;

  @Column({ type: 'varchar', length: 500, name: 'qr_code', nullable: true })
  qrCode: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: TicketStatus.RESERVED,
  })
  status: TicketStatus;

  @ManyToOne(() => Order, (order) => order.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => TicketType)
  @JoinColumn({ name: 'ticket_type_id' })
  ticketType: TicketType;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateUuidV7();
    }
  }
}
