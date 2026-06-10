import { Entity, PrimaryColumn, Column, CreateDateColumn, BeforeInsert } from 'typeorm';
import { generateUuidV7 } from '../utils/uuid';

export enum UserRole {
  AUDIENCE = 'audience',
  ORGANIZER = 'organizer',
  GATE_STAFF = 'gate_staff',
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
}

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: UserRole.AUDIENCE,
  })
  role: UserRole;

  @Column({
    type: 'varchar',
    length: 50,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateUuidV7();
    }
  }
}
