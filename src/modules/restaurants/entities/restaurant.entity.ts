import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../app/common/entities/base.entity';
import { Order } from '../../orders/entities/order.entity';
import { MenuCategory } from '../../menu/entities/menu-category.entity';

export enum RestaurantStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  BUSY = 'BUSY',
}

@Entity('restaurants')
export class Restaurant extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  phone: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ nullable: true })
  logoUrl: string | null;

  @Column({ nullable: true })
  coverUrl: string | null;

  @Column({ type: 'enum', enum: RestaurantStatus, default: RestaurantStatus.CLOSED })
  status: RestaurantStatus;

  @Column({ type: 'double precision', name: 'lat' })
  lat: number;

  @Column({ type: 'double precision', name: 'lng' })
  lng: number;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  rating: number;

  @Column({ type: 'int', default: 0 })
  ratingCount: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  deliveryFee: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  minimumOrder: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  estimatedPrepMinutes: number;

  @Column({ type: 'jsonb', default: [], name: 'cuisine_types' })
  cuisineTypes: string[];

  @Column({ type: 'jsonb', default: [], name: 'opening_hours' })
  openingHours: { day: string; from: string; to: string }[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Order, (order) => order.restaurant)
  orders: Order[];

  @OneToMany(() => MenuCategory, (category) => category.restaurantId)
  menuCategories: MenuCategory[];
}
