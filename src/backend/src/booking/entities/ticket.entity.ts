import {
  Entity,
  PrimaryColumn,
  Column,
  BeforeInsert,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { generateUuidV7 } from '../../auth/utils/uuid';
import { Order } from './order.entity';
import { TicketType } from '../../concert/entities/ticket-type.entity';
import { CheckinStatus } from '../../common/enums/checkin-status.enum';

export enum TicketStatus {
  RESERVED = 'reserved',
  ACTIVE = 'active',
  USED = 'used',
}


@Entity('tickets')
export class Ticket {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'order_id' })
  orderId: string;

  @Index()
  @Column({ type: 'uuid', name: 'ticket_type_id' })
  ticketTypeId: string;

  @Column({ type: 'varchar', length: 500, name: 'qr_code_hash', nullable: true, unique: true })
  qrCodeHash: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: TicketStatus.RESERVED,
  })
  status: TicketStatus;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'checkin_status',
    default: CheckinStatus.NOT_CHECKED_IN,
  })
  checkinStatus: CheckinStatus;

  @Column({ type: 'timestamp', name: 'checked_in_at', nullable: true })
  checkedInAt: Date | null;

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
