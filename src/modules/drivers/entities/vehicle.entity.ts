import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../app/common/entities/base.entity';
import { Driver } from './driver.entity';

export enum VehicleType {
  SEDAN = 'SEDAN',
  SUV = 'SUV',
  HATCHBACK = 'HATCHBACK',
  LUXURY = 'LUXURY',
  MOTORBIKE = 'MOTORBIKE',
  BIKE = 'BIKE',
  BICYCLE = 'BICYCLE',
}

@Entity('vehicles')
export class Vehicle extends BaseEntity {
  @ManyToOne(() => Driver, (driver) => driver.vehicles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Index()
  @Column({ name: 'driver_id' })
  driverId: string;

  @Column({ type: 'enum', enum: VehicleType, default: VehicleType.SEDAN })
  type: VehicleType;

  @Column()
  make: string;

  @Column()
  model: string;

  @Column({ length: 4 })
  year: string;

  @Column({ unique: true })
  plateNumber: string;

  @Column({ default: '#ffffff', nullable: true })
  color: string;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'int', default: 4 })
  capacity: number;
}
