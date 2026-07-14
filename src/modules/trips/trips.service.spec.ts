import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { TripsService } from './trips.service';
import { Trip, TripStatus, TripType } from './entities/trip.entity';
import { Driver, DriverStatus } from '../drivers/entities/driver.entity';
import { GoogleMapsService } from '../../infra/google-maps/google-maps.service';
import { RedisService } from '../../infra/redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TrackingGateway } from '../tracking/tracking.gateway';

describe('TripsService', () => {
  let service: TripsService;
  let tripsRepo: any;
  let driversRepo: any;
  let maps: any;
  let redis: any;
  let notifications: any;
  let tracking: any;

  const trip = (over: Record<string, any> = {}) => ({
    id: 'trip-1',
    customerId: 'cust-1',
    status: TripStatus.REQUESTED,
    type: TripType.RIDE,
    pickupLat: 25.2,
    pickupLng: 55.27,
    pickupAddress: 'A',
    destinationLat: 25.3,
    destinationLng: 55.3,
    destinationAddress: 'B',
    distanceKm: 0,
    durationSec: 0,
    fareEstimate: 0,
    finalFare: 0,
    surgeMultiplier: 1,
    passengerCount: 1,
    ...over,
  });

  const driver = (over: Record<string, any> = {}) => ({
    id: 'drv-1',
    userId: 'drv-user-1',
    isApproved: true,
    status: DriverStatus.ONLINE,
    type: 'RIDE',
    ...over,
  });

  beforeEach(async () => {
    tripsRepo = {
      create: jest.fn((x) => ({ ...x })),
      save: jest.fn(async (x) => ({ ...x })),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      increment: jest.fn(),
    };
    driversRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (x) => x),
      update: jest.fn(),
      increment: jest.fn(),
    };
    maps = {
      distanceMatrix: jest.fn(),
      estimateFare: jest.fn(),
      directions: jest.fn(),
    };
    redis = { nearby: jest.fn() };
    notifications = { sendToUser: jest.fn(), sendToTopic: jest.fn() };
    tracking = {
      broadcastTripUpdate: jest.fn(),
      broadcastDriverOffer: jest.fn(),
      broadcastOrderUpdate: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TripsService,
        { provide: getRepositoryToken(Trip), useValue: tripsRepo },
        { provide: getRepositoryToken(Driver), useValue: driversRepo },
        { provide: GoogleMapsService, useValue: maps },
        { provide: RedisService, useValue: redis },
        { provide: NotificationsService, useValue: notifications },
        { provide: TrackingGateway, useValue: tracking },
      ],
    }).compile();
    service = moduleRef.get(TripsService);
  });

  describe('requestTrip', () => {
    it('computes a fare estimate and stores a REQUESTED trip', async () => {
      maps.distanceMatrix.mockResolvedValue({ distanceMeters: 5000, durationSeconds: 600, polyline: '' });
      maps.estimateFare.mockReturnValue({ subtotal: 10.5, distanceKm: 5, durationMin: 10 });

      const created = await service.requestTrip('cust-1', {
        pickupLat: 25.2,
        pickupLng: 55.27,
        pickupAddress: 'A',
        destinationLat: 25.3,
        destinationLng: 55.3,
        destinationAddress: 'B',
      } as any);

      expect(created.status).toBe(TripStatus.REQUESTED);
      expect(created.fareEstimate).toBe(10.5);
      expect(maps.distanceMatrix).toHaveBeenCalled();
    });
  });

  describe('acceptTrip', () => {
    it('throws when the driver profile is missing', async () => {
      driversRepo.findOne.mockResolvedValue(null);
      await expect(service.acceptTrip('drv-user-1', 'trip-1')).rejects.toThrow(/Driver profile/);
    });

    it('throws when the driver is not approved', async () => {
      driversRepo.findOne.mockResolvedValue(driver({ isApproved: false }));
      await expect(service.acceptTrip('drv-user-1', 'trip-1')).rejects.toThrow(/approved/i);
    });

    it('assigns the driver, flips status, notifies and broadcasts on success', async () => {
      tripsRepo.findOne.mockResolvedValue(trip());
      driversRepo.findOne.mockResolvedValue(driver());

      const accepted = await service.acceptTrip('drv-user-1', 'trip-1');

      expect(accepted.driverId).toBe('drv-1');
      expect(accepted.status).toBe(TripStatus.ACCEPTED);
      expect(driversRepo.save).toHaveBeenCalled();
      expect(notifications.sendToUser).toHaveBeenCalled();
      expect(tracking.broadcastTripUpdate).toHaveBeenCalled();
      expect(tracking.broadcastDriverOffer).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('rejects CANCELLED from a non-participant', async () => {
      tripsRepo.findOne.mockResolvedValue(trip());
      driversRepo.findOne.mockResolvedValue(driver());
      await expect(
        service.updateStatus('stranger', 'trip-1', { status: TripStatus.CANCELLED } as any),
      ).rejects.toThrow(/Not allowed/i);
    });

    it('completes a trip: final fare, driver reset and trip counter', async () => {
      tripsRepo.findOne.mockResolvedValue(trip({ status: TripStatus.STARTED, driverId: 'drv-1' }));
      driversRepo.findOne.mockResolvedValue(driver());
      maps.distanceMatrix.mockResolvedValue({ distanceMeters: 8000, durationSeconds: 900, polyline: '' });
      maps.estimateFare.mockReturnValue({ subtotal: 14, distanceKm: 8, durationMin: 15 });

      const completed = await service.updateStatus('drv-user-1', 'trip-1', {
        status: TripStatus.COMPLETED,
      } as any);

      expect(completed.status).toBe(TripStatus.COMPLETED);
      expect(completed.finalFare).toBe(14);
      expect(driversRepo.update).toHaveBeenCalledWith('drv-1', { status: DriverStatus.ONLINE });
      expect(driversRepo.increment).toHaveBeenCalledWith({ id: 'drv-1' }, 'totalTrips', 1);
      expect(notifications.sendToUser).toHaveBeenCalled();
    });
  });

  describe('listAll (admin)', () => {
    it('returns the most recent trips', async () => {
      tripsRepo.find.mockResolvedValue([trip(), trip()]);
      const res = await service.listAll();
      expect(res.length).toBe(2);
      expect(tripsRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });
  });
});

describe('GoogleMapsService.estimateFare (pure logic)', () => {
  const svc = new GoogleMapsService({ get: () => '' } as any);

  it('applies the Uber-like fare formula', () => {
    const f = svc.estimateFare(10000, 600); // 10 km, 10 min
    expect(f.baseFare).toBe(2.5);
    expect(f.subtotal).toBeCloseTo(2.5 + 1.2 * 10 + 0.25 * 10, 2); // 15.5
    expect(f.distanceKm).toBe(10);
    expect(f.durationMin).toBe(10);
  });

  it('returns deterministic mock geometry when no API key is set', async () => {
    const r = await svc.distanceMatrix('25.2,55.27', '25.3,55.3');
    expect(r).toBeTruthy();
    expect(r!.distanceMeters).toBeGreaterThan(0);
    expect(r!.durationSeconds).toBeGreaterThan(0);
  });
});
