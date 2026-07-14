import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DriversService } from './drivers.service';
import { Driver, DriverStatus, DriverType } from './entities/driver.entity';
import { Vehicle, VehicleType } from './entities/vehicle.entity';
import { RedisService } from '../../infra/redis/redis.service';

describe('DriversService', () => {
  let service: DriversService;
  let driversRepo: any;
  let vehiclesRepo: any;
  let redis: any;

  const mockDriver = (over: Record<string, any> = {}) => ({
    id: 'drv-1',
    userId: 'u1',
    status: DriverStatus.ONLINE,
    isApproved: true,
    type: DriverType.BOTH,
    rating: 4.5,
    totalTrips: 10,
    totalDeliveries: 5,
    currentLat: 25.2,
    currentLng: 55.27,
    lastSeenAt: new Date(),
    vehicles: [],
    ...over,
  });

  beforeEach(async () => {
    driversRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (x) => x),
      update: jest.fn(),
      increment: jest.fn(),
      create: jest.fn((x) => ({ ...x, id: 'drv-new' })),
    };
    vehiclesRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (x) => x),
      create: jest.fn((x) => ({ ...x, id: 'v-new' })),
    };
    redis = {
      addGeo: jest.fn(),
      removeGeo: jest.fn(),
      nearby: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DriversService,
        { provide: getRepositoryToken(Driver), useValue: driversRepo },
        { provide: getRepositoryToken(Vehicle), useValue: vehiclesRepo },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    service = moduleRef.get(DriversService);
  });

  describe('findByUserId', () => {
    it('throws NotFoundException when driver profile not found', async () => {
      driversRepo.findOne.mockResolvedValue(null);
      await expect(service.findByUserId('nonexistent')).rejects.toThrow(/not found/i);
    });

    it('returns the driver profile', async () => {
      driversRepo.findOne.mockResolvedValue(mockDriver());
      const res = await service.findByUserId('u1');
      expect(res.id).toBe('drv-1');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when driver not found', async () => {
      driversRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(/not found/i);
    });

    it('returns the driver with relations', async () => {
      driversRepo.findOne.mockResolvedValue(mockDriver());
      const res = await service.findOne('drv-1');
      expect(res.id).toBe('drv-1');
    });
  });

  describe('list', () => {
    it('returns all drivers', async () => {
      driversRepo.find.mockResolvedValue([mockDriver()]);
      const res = await service.list();
      expect(res.length).toBe(1);
    });
  });

  describe('update', () => {
    it('updates and returns the driver', async () => {
      driversRepo.findOne.mockResolvedValue(mockDriver({ type: DriverType.RIDE }));
      const res = await service.update('u1', { type: DriverType.RIDE } as any);
      expect(res.type).toBe(DriverType.RIDE);
    });
  });

  describe('goOnline', () => {
    it('throws ForbiddenException when not approved', async () => {
      driversRepo.findOne.mockResolvedValue(mockDriver({ isApproved: false }));
      await expect(service.goOnline('u1')).rejects.toThrow(/not approved/i);
    });

    it('sets status to ONLINE and registers in geo index', async () => {
      driversRepo.findOne.mockResolvedValue(mockDriver({ status: DriverStatus.OFFLINE }));
      const res = await service.goOnline('u1');
      expect(res.status).toBe(DriverStatus.ONLINE);
      expect(redis.addGeo).toHaveBeenCalledWith('drivers:geo', 55.27, 25.2, 'drv-1');
    });
  });

  describe('goOffline', () => {
    it('sets status to OFFLINE and removes from geo index', async () => {
      driversRepo.findOne.mockResolvedValue(mockDriver());
      const res = await service.goOffline('u1');
      expect(res.status).toBe(DriverStatus.OFFLINE);
      expect(redis.removeGeo).toHaveBeenCalledWith('drivers:geo', 'drv-1');
      expect(redis.del).toHaveBeenCalledWith('driver:ping:drv-1');
    });
  });

  describe('pingLocation', () => {
    it('throws BadRequestException when driver is offline', async () => {
      driversRepo.findOne.mockResolvedValue(mockDriver({ status: DriverStatus.OFFLINE }));
      await expect(service.pingLocation('u1', { lat: 25.3, lng: 55.3 })).rejects.toThrow(/offline/i);
    });

    it('updates location and registers in geo index', async () => {
      driversRepo.findOne.mockResolvedValue(mockDriver());
      const res = await service.pingLocation('u1', { lat: 25.3, lng: 55.3 });
      expect(res.updated).toBe(true);
      expect(redis.addGeo).toHaveBeenCalledWith('drivers:geo', 55.3, 25.3, 'drv-1');
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe('nearby', () => {
    it('returns empty array when no drivers found', async () => {
      redis.nearby.mockResolvedValue([]);
      const res = await service.nearby(25.2, 55.27);
      expect(res).toEqual([]);
    });

    it('returns drivers with distance info', async () => {
      redis.nearby.mockResolvedValue([{ member: 'drv-1', distanceKm: 1.5 }]);
      driversRepo.find.mockResolvedValue([mockDriver()]);
      const res = await service.nearby(25.2, 55.27);
      expect(res.length).toBe(1);
      expect(res[0].distanceKm).toBe(1.5);
      expect(res[0].lat).toBe(25.2);
    });
  });

  describe('addVehicle', () => {
    it('throws ConflictException for duplicate plate number', async () => {
      driversRepo.findOne.mockResolvedValue(mockDriver());
      vehiclesRepo.findOne.mockResolvedValue({ id: 'existing-v' });
      await expect(
        service.addVehicle('u1', { plateNumber: 'ABC123', type: VehicleType.SEDAN } as any),
      ).rejects.toThrow(/already registered/i);
    });

    it('creates and saves a new vehicle', async () => {
      driversRepo.findOne.mockResolvedValue(mockDriver());
      vehiclesRepo.findOne.mockResolvedValue(null);
      const res = await service.addVehicle('u1', {
        plateNumber: 'ABC123',
        type: VehicleType.SEDAN,
        capacity: 4,
      } as any);
      expect(vehiclesRepo.create).toHaveBeenCalled();
      expect(vehiclesRepo.save).toHaveBeenCalled();
    });
  });

  describe('listVehicles', () => {
    it('returns vehicles for the driver', async () => {
      driversRepo.findOne.mockResolvedValue(mockDriver());
      vehiclesRepo.find.mockResolvedValue([{ id: 'v1', plateNumber: 'ABC123' }]);
      const res = await service.listVehicles('u1');
      expect(res.length).toBe(1);
    });
  });

  describe('verifyVehicle', () => {
    it('throws NotFoundException when vehicle not found', async () => {
      vehiclesRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyVehicle('u1', 'nonexistent')).rejects.toThrow(/not found/i);
    });

    it('throws ForbiddenException when not the owner', async () => {
      vehiclesRepo.findOne.mockResolvedValue({ id: 'v1', driverId: 'drv-other' });
      driversRepo.findOne.mockResolvedValue(mockDriver({ id: 'drv-other' }));
      // The driver.userId check will fail
      driversRepo.findOne
        .mockResolvedValueOnce({ id: 'v1', driverId: 'drv-other' }) // vehicle lookup
        .mockResolvedValueOnce(mockDriver({ id: 'drv-other', userId: 'u-other' })); // driver lookup
      await expect(service.verifyVehicle('u1', 'v1')).rejects.toThrow(/not your vehicle/i);
    });

    it('marks the vehicle as verified', async () => {
      vehiclesRepo.findOne.mockResolvedValue({ id: 'v1', driverId: 'drv-1', isVerified: false });
      driversRepo.findOne.mockResolvedValue(mockDriver());
      const res = await service.verifyVehicle('u1', 'v1');
      expect(res.isVerified).toBe(true);
    });
  });
});
