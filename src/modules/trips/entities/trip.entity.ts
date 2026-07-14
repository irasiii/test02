import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../app/common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Driver } from '../../drivers/entities/driver.entity';
import { Payment } from '../../payments/entities/payment.entity';

export enum TripStatus {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  DRIVER_ARRIVING = 'DRIVER_ARRIVING',
  DRIVER_ARRIVED = 'DRIVER_ARRIVED',
  STARTED = 'STARTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TripType {
  RIDE = 'RIDE',
  PARCEL = 'PARCEL',
}

@Entity('trips')
export class Trip extends BaseEntity {
  @ManyToOne(() => User, (user) => user.trips, { eager: false })
  customer: User;

  @Index()
  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Driver, (driver) => driver.trips, { eager: false, nullable: true })
  driver: Driver | null;

  @Index()
  @Column({ name: 'driver_id', nullable: true })
  driverId: string | null;

  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.REQUESTED })
  status: TripStatus;

  @Column({ type: 'enum', enum: TripType, default: TripType.RIDE })
  type: TripType;

  @Column({ type: 'double precision', name: 'pickup_lat' })
  pickupLat: number;

  @Column({ type: 'double precision', name: 'pickup_lng' })
  pickupLng: number;

  @Column({ type: 'text', name: 'pickup_address' })
  pickupAddress: string;

  @Column({ type: 'double precision', name: 'destination_lat' })
  destinationLat: number;

  @Column({ type: 'double precision', name: 'destination_lng' })
  destinationLng: number;

  @Column({ type: 'text', name: 'destination_address' })
  destinationAddress: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, name: 'distance_km' })
  distanceKm: number;

  @Column({ type: 'int', default: 0, name: 'duration_sec' })
  durationSec: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, name: 'fare_estimate' })
  fareEstimate: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, name: 'final_fare' })
  finalFare: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 1.0, name: 'surge_multiplier' })
  surgeMultiplier: number;

  @Column({ type: 'text', nullable: true })
  polyline: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'accepted_at' })
  acceptedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'started_at' })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'cancelled_at' })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'cancel_reason' })
  cancelReason: string | null;

  @Column({ type: 'int', default: 1, name: 'passenger_count' })
  passengerCount: number;

  @Column({ type: 'text', nullable: true, name: 'payment_intent_id' })
  paymentIntentId: string | null;
}
