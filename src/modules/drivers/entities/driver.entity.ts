import {
  Column,
  Entity,
  Index,
  OneToOne,
  OneToMany,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../../app/common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Vehicle } from './vehicle.entity';
import { Trip } from '../../trips/entities/trip.entity';
import { Order } from '../../orders/entities/order.entity';

export { Vehicle } from './vehicle.entity';

export enum DriverStatus {
  OFFLINE = 'OFFLINE',
  ONLINE = 'ONLINE',
  ON_TRIP = 'ON_TRIP',
  ON_DELIVERY = 'ON_DELIVERY',
}

export enum DriverType {
  RIDE = 'RIDE',
  FOOD = 'FOOD',
  BOTH = 'BOTH',
}

@Entity('drivers')
export class Driver extends BaseEntity {
  @OneToOne(() => User, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ type: 'enum', enum: DriverStatus, default: DriverStatus.OFFLINE })
  status: DriverStatus;

  @Column({ type: 'enum', enum: DriverType, default: DriverType.BOTH })
  type: DriverType;

  @Column({ type: 'double precision', default: 0, name: 'current_lat' })
  currentLat: number;

  @Column({ type: 'double precision', default: 0, name: 'current_lng' })
  currentLng: number;

  @Column({ type: 'double precision', default: 0 })
  rating: number;

  @Column({ type: 'int', default: 0 })
  totalTrips: number;

  @Column({ type: 'int', default: 0 })
  totalDeliveries: number;

  @Column({ type: 'boolean', default: true })
  isApproved: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_seen_at' })
  lastSeenAt: Date | null;

  @OneToMany(() => Vehicle, (vehicle) => vehicle.driver)
  vehicles: Vehicle[];

  @OneToMany(() => Trip, (trip) => trip.driver)
  trips: Trip[];

  @OneToMany(() => Order, (order) => order.driver)
  orders: Order[];
}
