import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';

import { Order, OrderItem, OrderStatus, PaymentMethod } from './entities/order.entity';
import { CreateOrderDto } from './dtos/create-order.dto';
import { UpdateOrderStatusDto } from './dtos/update-order-status.dto';
import { Restaurant, RestaurantStatus } from '../restaurants/entities/restaurant.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Driver, DriverStatus } from '../drivers/entities/driver.entity';
import { GoogleMapsService } from '../../infra/google-maps/google-maps.service';
import { RedisService } from '../../infra/redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TrackingGateway } from '../tracking/tracking.gateway';

const SERVICE_FEE_RATE = 0.05; // 5% platform fee
const TAX_RATE = 0.05; // 5% tax (configurable per region)
const DRIVER_NEEDED_RADIUS_KM = 5;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Restaurant) private readonly restaurants: Repository<Restaurant>,
    @InjectRepository(MenuItem) private readonly items: Repository<MenuItem>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    private readonly maps: GoogleMapsService,
    private readonly redis: RedisService,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly tracking: TrackingGateway,
  ) {}

  async create(customerId: string, dto: CreateOrderDto) {
    const restaurant = await this.restaurants.findOne({ where: { id: dto.restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    if (restaurant.status === RestaurantStatus.CLOSED) {
      throw new BadRequestException('Restaurant is currently closed');
    }

    // Validate + load each item.
    const itemIds = dto.items.map((i) => i.menuItemId);
    const validItems = await this.items.find({ where: { id: In(itemIds) } });
    if (validItems.length !== dto.items.length) {
      throw new BadRequestException('One or more menu items not found');
    }
    if (validItems.some((i) => !i.isAvailable || i.restaurantId !== restaurant.id)) {
      throw new BadRequestException('Item unavailable or wrong restaurant');
    }

    // Calculate subtotal.
    let subtotal = 0;
    const orderItems: OrderItem[] = [];
    for (const input of dto.items) {
      const mi = validItems.find((v) => v.id === input.menuItemId)!;
      const lineTotal = Number((Number(mi.price) * input.quantity).toFixed(2));
      subtotal += lineTotal;
      orderItems.push({
        menuItemId: mi.id,
        quantity: input.quantity,
        unitPrice: Number(mi.price),
        lineTotal,
        specialInstructions: input.specialInstructions ?? null,
      } as OrderItem);
    }
    subtotal = Number(subtotal.toFixed(2));

    if (subtotal < Number(restaurant.minimumOrder)) {
      throw new BadRequestException(
        `Below minimum order (${restaurant.minimumOrder})`,
      );
    }

    // Distance + delivery fee.
    const route = await this.maps.distanceMatrix(
      `${restaurant.lat},${restaurant.lng}`,
      `${dto.deliveryLat},${dto.deliveryLng}`,
    );
    const distanceKm = route ? route.distanceMeters / 1000 : 0;
    const deliveryFee = Number(restaurant.deliveryFee) + Number((distanceKm * 0.3).toFixed(2));
    const serviceFee = Number((subtotal * SERVICE_FEE_RATE).toFixed(2));
    const tax = Number((subtotal * TAX_RATE).toFixed(2));
    const total = Number((subtotal + deliveryFee + serviceFee + tax).toFixed(2));
    // Note: numeric columns come back from Postgres as strings — coerce before adding.
    const etaMinutes = Math.round(Number(restaurant.estimatedPrepMinutes ?? 20)) + Math.ceil((route?.durationSeconds ?? 1200) / 60);

    const order = this.orders.create({
      customerId,
      restaurantId: restaurant.id,
      status: OrderStatus.PENDING,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.CARD,
      subtotal,
      deliveryFee,
      serviceFee,
      tax,
      discount: 0,
      total,
      deliveryAddress: dto.deliveryAddress,
      deliveryLat: dto.deliveryLat,
      deliveryLng: dto.deliveryLng,
      customerNote: dto.customerNote,
      etaMinutes,
      scheduled: dto.scheduled ?? false,
    });

    let savedOrder: Order;
    await this.dataSource.transaction(async (em) => {
      savedOrder = await em.save(order);
      await Promise.all(
        orderItems.map((oi) => em.save(OrderItem, { ...oi, orderId: savedOrder!.id } as OrderItem)),
      );
    });
    return savedOrder!;
  }

  async updateStatus(
    actorUserId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
    isAdmin = false,
  ) {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: ['restaurant'],
    });
    if (!order) throw new NotFoundException('Order not found');

    // Determine actor role/permission.
    const driver = await this.drivers.findOne({ where: { userId: actorUserId } });
    const isCustomer = order.customerId === actorUserId;
    const isDriver = driver && order.driverId === driver.id;
    const isRestaurant = !!(order.restaurant && order.restaurant.ownerId === actorUserId);

    if (dto.status === OrderStatus.CANCELLED) {
      if (!isCustomer && !isAdmin) throw new ForbiddenException('Only customer or admin can cancel');
      if ([OrderStatus.PICKED_UP, OrderStatus.ON_THE_WAY, OrderStatus.DELIVERED].includes(order.status)) {
        throw new BadRequestException('Cannot cancel an in-progress order');
      }
      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
      order.cancelReason = dto.cancelReason ?? null;
      await this.orders.save(order);
      await this.broadcast(order, 'Order cancelled');
      return order;
    }

    // Restaurant statuses
    if ([OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.REJECTED].includes(dto.status)) {
      if (!isRestaurant && !isAdmin) throw new ForbiddenException('Only restaurant can set this status');
      if (dto.status === OrderStatus.ACCEPTED) order.acceptedAt = new Date();
      if (dto.status === OrderStatus.READY) order.preparedAt = new Date();
      order.status = dto.status;
      await this.orders.save(order);
      // Try to assign a nearby FOOD driver as soon as the order is READY.
      if (dto.status === OrderStatus.READY && !order.driverId && order.restaurant) {
        await this.assignDriver(order.id, order.restaurant.lat, order.restaurant.lng);
      }
      await this.broadcast(order, `Order is now ${order.status}`);
      return order;
    }

    // Driver statuses
    if ([OrderStatus.PICKED_UP, OrderStatus.ON_THE_WAY, OrderStatus.DELIVERED].includes(dto.status)) {
      if (!isDriver && !isAdmin) throw new ForbiddenException('Only the assigned driver can set this status');
      if (dto.status === OrderStatus.PICKED_UP) order.pickedUpAt = new Date();
      if (dto.status === OrderStatus.DELIVERED) order.deliveredAt = new Date();
      order.status = dto.status;
      await this.orders.save(order);
      if (dto.status === OrderStatus.DELIVERED && driver) {
        await this.drivers.increment({ id: driver.id }, 'totalDeliveries', 1);
        await this.drivers.update(driver.id, { status: DriverStatus.ONLINE });
      }
      await this.broadcast(order, `Order is ${order.status}`);
      return order;
    }

    throw new BadRequestException('Invalid status transition');
  }

  /** Push + ws broadcast helper */
  private async broadcast(order: Order, defaultTitle: string) {
    this.tracking.broadcastOrderUpdate(order.id, { status: order.status });
    await this.notifications.sendToUser(
      order.customerId,
      'Order update',
      `${defaultTitle} (#${order.id.slice(0, 8)})`,
      { orderId: order.id, status: order.status },
    );
  }

  /** Restaurant accepts an order and the matching engine assigns nearest driver */
  async accept(orderId: string, restaurantOwnerId: string) {
    return this.updateStatus(restaurantOwnerId, orderId, {
      status: OrderStatus.ACCEPTED,
    });
  }

  /** Admin: list all orders with relations, newest first. */
  async listAll(limit = 100) {
    return this.orders.find({
      relations: ['restaurant', 'customer', 'driver', 'driver.user'],
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 500),
    });
  }

  async listMine(customerId: string) {
    return this.orders.find({
      where: { customerId },
      relations: ['restaurant'],
      order: { createdAt: 'DESC' },
      take: 30,
    });
  }

  async listForRestaurant(restaurantId: string, actor?: { id: string; isAdmin: boolean }) {
    if (actor) {
      const r = await this.restaurants.findOne({ where: { id: restaurantId } });
      if (!r) throw new NotFoundException('Restaurant not found');
      if (!actor.isAdmin && r.ownerId !== actor.id) {
        throw new ForbiddenException('You do not own this restaurant');
      }
    }
    return this.orders.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async listForDriver(driverUserId: string) {
    const driver = await this.drivers.findOne({ where: { userId: driverUserId } });
    if (!driver) return [];
    return this.orders.find({
      where: { driverId: driver.id },
      relations: ['restaurant', 'customer'],
      order: { createdAt: 'DESC' },
      take: 30,
    });
  }

  async findOne(id: string) {
    const order = await this.orders.findOne({
      where: { id },
      relations: ['restaurant', 'customer', 'driver', 'driver.user'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** Match nearest available food driver for a READY order. */
  async assignDriver(orderId: string, _restaurantLat: number, _restaurantLng: number): Promise<string | null> {
    const ids = await this.redis.nearby(
      'drivers:geo',
      _restaurantLng,
      _restaurantLat,
      DRIVER_NEEDED_RADIUS_KM,
      10,
    );
    if (!ids.length) return null;
    const available = await this.drivers.find({ where: ids.map((r) => ({ id: r.member })) });
    const candidate = available.find(
      (d) =>
        d.status === DriverStatus.ONLINE &&
        (d.type === ('BOTH' as any) || d.type === ('FOOD' as any)),
    );
    if (!candidate) return null;
    await this.orders.update(orderId, { driverId: candidate.id });
    await this.drivers.update(candidate.id, { status: DriverStatus.ON_DELIVERY });
    return candidate.id;
  }
}
