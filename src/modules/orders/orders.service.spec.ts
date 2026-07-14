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
  });

  describe('updateStatus', () => {
    it('only lets the customer cancel', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'cust-1',
        restaurant: { email: 'r@x' },
        driverId: null,
        status: OrderStatus.PENDING,
      });
      await expect(
        service.updateStatus('stranger', 'o1', { status: OrderStatus.CANCELLED } as any),
      ).rejects.toThrow(/Only customer/);
    });

    it('on DELIVERED resets the driver and increments deliveries', async () => {
      ordersRepo.findOne.mockResolvedValue({
        id: 'o1',
        customerId: 'c',
        restaurant: { email: 'r@x' },
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
  });

  describe('listAll (admin)', () => {
    it('returns the most recent orders', async () => {
      ordersRepo.find.mockResolvedValue([{}, {}]);
      const res = await service.listAll();
      expect(res.length).toBe(2);
      expect(ordersRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });
  });
});
