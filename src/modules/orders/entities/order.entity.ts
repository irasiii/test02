import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../app/common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Driver } from '../../drivers/entities/driver.entity';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';
import { MenuItem } from '../../menu/entities/menu-item.entity';

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  WALLET = 'WALLET',
  APPLE_PAY = 'APPLE_PAY',
  GOOGLE_PAY = 'GOOGLE_PAY',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  PICKED_UP = 'PICKED_UP',
  ON_THE_WAY = 'ON_THE_WAY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

@Entity('orders')
export class Order extends BaseEntity {
  @ManyToOne(() => User, (user) => user.orders, { eager: false })
  customer: User;

  @Index()
  @Column({ name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.orders, { eager: false })
  restaurant: Restaurant;

  @Index()
  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => Driver, (driver) => driver.orders, { eager: false, nullable: true })
  driver: Driver | null;

  @Index()
  @Column({ name: 'driver_id', nullable: true })
  driverId: string | null;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CARD })
  paymentMethod: PaymentMethod;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, name: 'subtotal' })
  subtotal: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, name: 'delivery_fee' })
  deliveryFee: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, name: 'service_fee' })
  serviceFee: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, name: 'tax' })
  tax: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, name: 'discount' })
  discount: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, name: 'total' })
  total: number;

  @Column({ type: 'text', name: 'delivery_address' })
  deliveryAddress: string;

  @Column({ type: 'double precision', name: 'delivery_lat' })
  deliveryLat: number;

  @Column({ type: 'double precision', name: 'delivery_lng' })
  deliveryLng: number;

  @Column({ type: 'text', nullable: true, name: 'customer_note' })
  customerNote: string | null;

  @Column({ type: 'text', nullable: true, name: 'payment_intent_id' })
  paymentIntentId: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'accepted_at' })
  acceptedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'prepared_at' })
  preparedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'picked_up_at' })
  pickedUpAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'delivered_at' })
  deliveredAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'cancelled_at' })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'cancel_reason' })
  cancelReason: string | null;

  @Column({ type: 'int', default: 0, name: 'eta_minutes' })
  etaMinutes: number;

  @Column({ type: 'boolean', default: false })
  scheduled: boolean;
}

@Entity('order_items')
export class OrderItem extends BaseEntity {
  @Index()
  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  order: Order;

  @Column({ name: 'menu_item_id' })
  menuItemId: string;

  @ManyToOne(() => MenuItem, { eager: true })
  menuItem: MenuItem;

  @Column({ type: 'int', default: 1, name: 'quantity' })
  quantity: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, name: 'unit_price' })
  unitPrice: number;

  @Column({ type: 'text', nullable: true, name: 'special_instructions' })
  specialInstructions: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0, name: 'line_total' })
  lineTotal: number;
}
