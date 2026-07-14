import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../app/common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentPurpose {
  TRIP = 'TRIP',
  ORDER = 'ORDER',
  TOPUP = 'TOPUP',
  REFERRAL = 'REFERRAL',
}

@Entity('payments')
export class Payment extends BaseEntity {
  @ManyToOne(() => User, (user) => user.payments)
  user: User;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: PaymentPurpose })
  purpose: PaymentPurpose;

  @Column({ type: 'text', nullable: true, name: 'reference_id' })
  referenceId: string | null; // Trip.id or Order.id

  @Column({ type: 'text', unique: true, nullable: true, name: 'provider_intent_id' })
  providerIntentId: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'usd' })
  currency: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: {}, name: 'provider_payload' })
  providerPayload: Record<string, unknown>;
}
