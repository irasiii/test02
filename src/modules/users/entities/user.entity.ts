import {
  Column,
  Entity,
  Index,
  OneToMany,
  BeforeInsert,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../../app/common/entities/base.entity';
import { Role } from '../../../app/common/decorators/roles.decorator';
import { Trip } from '../../trips/entities/trip.entity';
import { Order } from '../../orders/entities/order.entity';
import { Rating } from '../../ratings/entities/rating.entity';
import { Payment } from '../../payments/entities/payment.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ name: 'phone', unique: true, length: 20 })
  phone: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'enum', enum: Role, default: Role.CUSTOMER })
  role: Role;

  @Column({ nullable: true })
  @Exclude()
  passwordHash: string | null;

  @Column({ nullable: true })
  avatarUrl: string | null;

  // FK token used by FCM to deliver push notifications.
  @Column({ name: 'fcm_token', nullable: true })
  fcmToken: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  walletBalance: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: {}, name: 'metadata' })
  metadata: Record<string, unknown>;

  @OneToMany(() => Trip, (trip) => trip.customer)
  trips: Trip[];

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];

  @OneToMany(() => Rating, (rating) => rating.reviewer)
  givenRatings: Rating[];

  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];

  @BeforeInsert()
  lowerEmail(): void {
    if (this.email) this.email = this.email.toLowerCase();
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
