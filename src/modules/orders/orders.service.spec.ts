import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { OrdersService } from './orders.service';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { Restaurant, RestaurantStatus } from '../restaurants/entities/restaurant.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Driver, DriverStatus } from '../drivers/entities/driver.entity';
import { GoogleMapsService } from '../../infra/google-maps/google-maps.service';
import { RedisService } from '../../infra/redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TrackingGateway } from '../tracking/tracking.gateway';

describe('OrdersService', () => {
  let service: OrdersService;
  let ordersRepo: any;
  let restaurantsRepo: any;
  let itemsRepo: any;
  let driversRepo: any;
  let maps: any;
  let redis: any;
  let dataSource: any;
  let notifications: any;
  let tracking: any;

  const restaurant = () => ({
    id: 'rest-1',
    name: 'Burgers',
    email: 'burgers@geny.app',
    ownerId: 'owner-user-1',
    status: RestaurantStatus.OPEN,
    minimumOrder: 10,
    deliveryFee: 2,
    lat: 25.2,
    lng: 55.27,
    estimatedPrepMinutes: 15,
  });

  beforeEach(async () => {
    ordersRepo = {
      create: jest.fn((x) => ({ ...x })),
      save: jest.fn(async (x) => ({ ...x })),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    restaurantsRepo = { find: jest.fn(), findOne: jest.fn(), update: jest.fn() };
    itemsRepo = { find: jest.fn() };
    driversRepo = { find: jest.fn(), findOne: jest.fn(), update: jest.fn(), increment: jest.fn() };
    maps = { distanceMatrix: jest.fn(), estimateFare: jest.fn() };
    redis = { nearby: jest.fn() };
    dataSource = {
      transaction: jest.fn(async (cb: any) => cb({ save: jest.fn(async (x: any) => x) })),
    };
    notifications = { sendToUser: jest.fn() };
    tracking = { broadcastOrderUpdate: jest.fn(), broadcastTripUpdate: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: getRepositoryToken(Restaurant), useValue: restaurantsRepo },
        { provide: getRepositoryToken(MenuItem), useValue: itemsRepo },
        { provide: getRepositoryToken(Driver), useValue: driversRepo },
        { provide: GoogleMapsService, useValue: maps },
        { provide: RedisService, useValue: redis },
        { provide: DataSource, useValue: dataSource },
        { provide: NotificationsService, useValue: notifications },
        { provide: TrackingGateway, useValue: tracking },
      ],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  const validDto = () => ({
    restaurantId: 'rest-1',
    items: [{ menuItemId: 'm1', quantity: 1 }],
    deliveryLat: 25.3,
    deliveryLng: 55.3,
    deliveryAddress: 'X',
  } as any);

  describe('create', () => {
    it('throws when the restaurant is missing', async () => {
      restaurantsRepo.findOne.mockResolvedValue(null);
      await expect(service.create('cust-1', validDto())).rejects.toThrow(/Restaurant not found/);
    });

    it('throws when the restaurant is CLOSED', async () => {
      restaurantsRepo.findOne.mockResolvedValue({ ...restaurant(), status: RestaurantStatus.CLOSED });
      await expect(service.create('cust-1', validDto())).rejects.toThrow(/closed/i);
    });

    it('throws when a menu item is unknown', async () => {
      restaurantsRepo.findOne.mockResolvedValue(restaurant());
      itemsRepo.find.mockResolvedValue([]);
      await expect(service.create('cust-1', validDto())).rejects.toThrow(/menu items not found/);
    });

    it('throws when below the minimum order', async () => {
      restaurantsRepo.findOne.mockResolvedValue(restaurant());
      itemsRepo.find.mockResolvedValue([{ id: 'm1', price: 3, isAvailable: true, restaurantId: 'rest-1' }]);
      maps.distanceMatrix.mockResolvedValue({ distanceMeters: 2000, durationSeconds: 300 });
      await expect(service.create('cust-1', validDto())).rejects.toThrow(/minimum order/i);
    });

    it('throws when item is unavailable', async () => {
      restaurantsRepo.findOne.mockResolvedValue(restaurant());
      itemsRepo.find.mockResolvedValue([{ id: 'm1', price: 15, isAvailable: false, restaurantId: 'rest-1' }]);
      await expect(service.create('cust-1', validDto())).rejects.toThrow(/unavailable/i);
    });

    it('throws when item is from wrong restaurant', async () => {
      restaurantsRepo.findOne.mockResolvedValue(restaurant());
      itemsRepo.find.mockResolvedValue([{ id: 'm1', price: 15, isAvailable: true, restaurantId: 'rest-other' }]);
      await expect(service.create('cust-1', validDto())).rejects.toThrow(/unavailable/i);
    });

    it('computes totals: subtotal + delivery + service fee + tax', async () => {
      restaurantsRepo.findOne.mockResolvedValue(restaurant());
      itemsRepo.find.mockResolvedValue([{ id: 'm1', price: 12, isAvailable: true, restaurantId: 'rest-1' }]);
      maps.distanceMatrix.mockResolvedValue({ distanceMeters: 2000, durationSeconds: 300 }); // 2 km

      const order = await service.create('cust-1', validDto());

      expect(order.subtotal).toBe(12);
      expect(order.deliveryFee).toBeCloseTo(2 + 2 * 0.3, 2); // 2.6
      expect(order.serviceFee).toBeCloseTo(12 * 0.05, 2); // 0.6
      expect(order.tax).toBeCloseTo(12 * 0.05, 2); // 0.6
      expect(order.total).toBeCloseTo(12 + 2.6 + 0.6 + 0.6, 2);
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('handles multiple items in one order', async () => {
      restaurantsRepo.findOne.mockResolvedValue(restaurant());
      itemsRepo.find.mockResolvedValue([
        { id: 'm1', price: 10, isAvailable: true, restaurantId: 'rest-1' },
        { id: 'm2', price: 8, isAvailable: true, restaurantId: 'rest-1' },
      ]);
      maps.distanceMatrix.mockResolvedValue({ distanceMeters: 1000, durationSeconds: 180 });

      const dto = {
        ...validDto(),
        items: [
          { menuItemId: 'm1', quantity: 2 },
          { menuItemId: 'm2', quantity: 1 },
        ],
      };
      const order = await service.create('cust-1', dto);
      expect(order.subtotal).toBe(28); // 10*2 + 8*1
    });
  });

  describe('updateStatus', () => {
    it('only lets the customer or admin cancel', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'cust-1',
        restaurant: { email: 'r@x', ownerId: 'owner-1' },
        driverId: null,
        status: OrderStatus.PENDING,
      });
      await expect(
        service.updateStatus('stranger', 'o1', { status: OrderStatus.CANCELLED } as any),
      ).rejects.toThrow(/Only customer or admin can cancel/);
    });

    it('allows admin to cancel', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'cust-1',
        restaurant: { email: 'r@x', ownerId: 'owner-1' },
        driverId: null,
        status: OrderStatus.PENDING,
      });
      const cancelled = await service.updateStatus('admin-1', 'o1', { status: OrderStatus.CANCELLED } as any, true);
      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
    });

    it('throws when cancelling an in-progress order', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'cust-1',
        restaurant: { email: 'r@x', ownerId: 'owner-1' },
        driverId: null,
        status: OrderStatus.PICKED_UP,
      });
      await expect(
        service.updateStatus('cust-1', 'o1', { status: OrderStatus.CANCELLED } as any),
      ).rejects.toThrow(/in-progress/i);
    });

    it('restaurant can accept an order', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'cust-1',
        restaurant: { email: 'r@x', ownerId: 'owner-1' },
        driverId: null,
        status: OrderStatus.PENDING,
      });
      const accepted = await service.updateStatus('owner-1', 'o1', { status: OrderStatus.ACCEPTED } as any);
      expect(accepted.status).toBe(OrderStatus.ACCEPTED);
      expect(accepted.acceptedAt).toBeDefined();
    });

    it('restaurant can set PREPARING status', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'cust-1',
        restaurant: { email: 'r@x', ownerId: 'owner-1' },
        driverId: null,
        status: OrderStatus.ACCEPTED,
      });
      const result = await service.updateStatus('owner-1', 'o1', { status: OrderStatus.PREPARING } as any);
      expect(result.status).toBe(OrderStatus.PREPARING);
    });

    it('restaurant can set READY status', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'cust-1',
        restaurant: { email: 'r@x', ownerId: 'owner-1' },
        driverId: null,
        status: OrderStatus.PREPARING,
      });
      redis.nearby.mockResolvedValue([]);
      const result = await service.updateStatus('owner-1', 'o1', { status: OrderStatus.READY } as any);
      expect(result.status).toBe(OrderStatus.READY);
      expect(result.preparedAt).toBeDefined();
    });

    it('restaurant can REJECT an order', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'cust-1',
        restaurant: { email: 'r@x', ownerId: 'owner-1' },
        driverId: null,
        status: OrderStatus.PENDING,
      });
      const result = await service.updateStatus('owner-1', 'o1', { status: OrderStatus.REJECTED } as any);
      expect(result.status).toBe(OrderStatus.REJECTED);
    });

    it('non-restaurant actor cannot set restaurant statuses', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'cust-1',
        restaurant: { email: 'r@x', ownerId: 'owner-1' },
        driverId: null,
        status: OrderStatus.PENDING,
      });
      await expect(
        service.updateStatus('stranger', 'o1', { status: OrderStatus.ACCEPTED } as any),
      ).rejects.toThrow(/Only restaurant/i);
    });

    it('driver can set PICKED_UP status', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'cust-1',
        restaurant: { email: 'r@x', ownerId: 'owner-1' },
        driverId: 'drv-1',
        status: OrderStatus.READY,
      });
      driversRepo.findOne.mockResolvedValue({ id: 'drv-1', userId: 'drv-user-1' });
      const result = await service.updateStatus('drv-user-1', 'o1', { status: OrderStatus.PICKED_UP } as any);
      expect(result.status).toBe(OrderStatus.PICKED_UP);
      expect(result.pickedUpAt).toBeDefined();
    });

    it('driver can set ON_THE_WAY status', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'cust-1',
        restaurant: { email: 'r@x', ownerId: 'owner-1' },
        driverId: 'drv-1',
        status: OrderStatus.PICKED_UP,
      });
      driversRepo.findOne.mockResolvedValue({ id: 'drv-1', userId: 'drv-user-1' });
      const result = await service.updateStatus('drv-user-1', 'o1', { status: OrderStatus.ON_THE_WAY } as any);
      expect(result.status).toBe(OrderStatus.ON_THE_WAY);
    });

    it('non-driver cannot set driver statuses', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'cust-1',
        restaurant: { email: 'r@x', ownerId: 'owner-1' },
        driverId: 'drv-1',
        status: OrderStatus.READY,
      });
      driversRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus('stranger', 'o1', { status: OrderStatus.PICKED_UP } as any),
      ).rejects.toThrow(/Only the assigned driver/i);
    });

    it('on DELIVERED resets the driver and increments deliveries', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'c',
        restaurant: { email: 'r@x', ownerId: 'owner-1' },
        driverId: 'drv-1',
        status: OrderStatus.ON_THE_WAY,
      });
      driversRepo.findOne.mockResolvedValue({ id: 'drv-1', userId: 'drv-user-1' });

      const delivered = await service.updateStatus('drv-user-1', 'o1', {
        status: OrderStatus.DELIVERED,
      } as any);

      expect(delivered.status).toBe(OrderStatus.DELIVERED);
      expect(driversRepo.increment).toHaveBeenCalledWith({ id: 'drv-1' }, 'totalDeliveries', 1);
      expect(driversRepo.update).toHaveBeenCalledWith('drv-1', { status: DriverStatus.ONLINE });
    });

    it('throws on invalid status transition', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'cust-1',
        restaurant: { email: 'r@x', ownerId: 'owner-1' },
        driverId: null,
        status: OrderStatus.DELIVERED,
      });
      await expect(
        service.updateStatus('cust-1', 'o1', { status: 'INVALID_STATUS' } as any),
      ).rejects.toThrow(/Invalid status transition/i);
    });
  });

  describe('listAll (admin)', () => {
    it('returns the most recent orders', async () => {
      ordersRepo.find.mockResolvedValue([{}, {}]);
      const res = await service.listAll();
      expect(res.length).toBe(2);
      expect(ordersRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });
  });

  describe('listMine', () => {
    it('returns orders for a customer', async () => {
      ordersRepo.find.mockResolvedValue([{ id: 'o1' }]);
      const res = await service.listMine('cust-1');
      expect(res.length).toBe(1);
      expect(ordersRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customerId: 'cust-1' } }),
      );
    });
  });

  describe('listForRestaurant', () => {
    it('returns orders for a restaurant', async () => {
      ordersRepo.find.mockResolvedValue([{ id: 'o1' }]);
      const res = await service.listForRestaurant('rest-1');
      expect(res.length).toBe(1);
    });

    it('throws when actor does not own the restaurant', async () => {
      restaurantsRepo.findOne.mockResolvedValue({ id: 'rest-1', ownerId: 'owner-1' });
      await expect(
        service.listForRestaurant('rest-1', { id: 'stranger', isAdmin: false }),
      ).rejects.toThrow(/do not own/i);
    });

    it('allows admin to list any restaurant orders', async () => {
      restaurantsRepo.findOne.mockResolvedValue({ id: 'rest-1', ownerId: 'owner-1' });
      ordersRepo.find.mockResolvedValue([]);
      const res = await service.listForRestaurant('rest-1', { id: 'admin-1', isAdmin: true });
      expect(res).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when order not found', async () => {
      ordersRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(/not found/i);
    });

    it('returns the order', async () => {
      ordersRepo.findOne.mockResolvedValue({ id: 'o1', total: 25 });
      const res = await service.findOne('o1');
      expect(res.id).toBe('o1');
    });
  });

  describe('listForDriver', () => {
    it('returns empty array when driver profile not found', async () => {
      driversRepo.findOne.mockResolvedValue(null);
      const res = await service.listForDriver('nonexistent');
      expect(res).toEqual([]);
    });

    it('returns orders for the driver', async () => {
      driversRepo.findOne.mockResolvedValue({ id: 'drv-1' });
      ordersRepo.find.mockResolvedValue([{ id: 'o1' }]);
      const res = await service.listForDriver('drv-user-1');
      expect(res.length).toBe(1);
    });
  });
});
