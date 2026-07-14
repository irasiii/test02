import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { RestaurantsService } from './restaurants.service';
import { Restaurant, RestaurantStatus } from './entities/restaurant.entity';

describe('RestaurantsService', () => {
  let service: RestaurantsService;
  let restaurantsRepo: any;

  const mockRestaurant = (over: Record<string, any> = {}) => ({
    id: 'rest-1',
    name: 'Burgers',
    email: 'burgers@geny.app',
    ownerId: 'u-owner-1',
    status: RestaurantStatus.OPEN,
    minimumOrder: 10,
    deliveryFee: 2,
    lat: 25.2,
    lng: 55.27,
    estimatedPrepMinutes: 15,
    rating: 4.0,
    ratingCount: 10,
    isActive: true,
    ...over,
  });

  beforeEach(async () => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    restaurantsRepo = {
      create: jest.fn((x) => ({ ...x, id: 'rest-new' })),
      save: jest.fn(async (x) => x),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(() => qb),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RestaurantsService,
        { provide: getRepositoryToken(Restaurant), useValue: restaurantsRepo },
      ],
    }).compile();
    service = moduleRef.get(RestaurantsService);
  });

  describe('create', () => {
    it('creates a restaurant with default values', async () => {
      const res = await service.create({ name: 'Pizza', email: 'pizza@geny.app' } as any, 'u-owner-1');
      expect(restaurantsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Pizza',
          ownerId: 'u-owner-1',
          status: RestaurantStatus.OPEN,
          rating: 0,
          ratingCount: 0,
          isActive: true,
        }),
      );
      expect(restaurantsRepo.save).toHaveBeenCalled();
    });

    it('creates without ownerId when not provided', async () => {
      await service.create({ name: 'Tacos' } as any);
      expect(restaurantsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: null }),
      );
    });
  });

  describe('findAll', () => {
    it('returns active restaurants', async () => {
      const qb = restaurantsRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([mockRestaurant()]);
      const res = await service.findAll();
      expect(res.length).toBe(1);
    });

    it('applies filter when provided', async () => {
      const qb = restaurantsRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([mockRestaurant()]);
      await service.findAll({ filter: 'burger' });
      expect(qb.andWhere).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      restaurantsRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(/not found/i);
    });

    it('returns the restaurant', async () => {
      restaurantsRepo.findOne.mockResolvedValue(mockRestaurant());
      const res = await service.findOne('rest-1');
      expect(res.id).toBe('rest-1');
    });
  });

  describe('assertOwned', () => {
    it('throws ForbiddenException when not owner and not admin', async () => {
      restaurantsRepo.findOne.mockResolvedValue(mockRestaurant({ ownerId: 'u-other' }));
      await expect(service.assertOwned('rest-1', 'u-not-owner', false)).rejects.toThrow(/do not own/i);
    });

    it('allows admin to access any restaurant', async () => {
      restaurantsRepo.findOne.mockResolvedValue(mockRestaurant({ ownerId: 'u-other' }));
      const res = await service.assertOwned('rest-1', 'u-admin', true);
      expect(res.id).toBe('rest-1');
    });

    it('allows owner to access own restaurant', async () => {
      restaurantsRepo.findOne.mockResolvedValue(mockRestaurant({ ownerId: 'u-owner-1' }));
      const res = await service.assertOwned('rest-1', 'u-owner-1', false);
      expect(res.id).toBe('rest-1');
    });
  });

  describe('update', () => {
    it('updates when no actorId (no ownership check)', async () => {
      restaurantsRepo.findOne.mockResolvedValue(mockRestaurant({ name: 'Updated' }));
      const res = await service.update('rest-1', { name: 'Updated' } as any);
      expect(restaurantsRepo.update).toHaveBeenCalledWith('rest-1', { name: 'Updated' });
      expect(res.name).toBe('Updated');
    });

    it('asserts ownership when actorId provided', async () => {
      restaurantsRepo.findOne.mockResolvedValue(mockRestaurant({ ownerId: 'u-owner-1' }));
      await expect(
        service.update('rest-1', { name: 'X' } as any, 'u-not-owner', false),
      ).rejects.toThrow(/do not own/i);
    });
  });

  describe('remove', () => {
    it('soft-deletes the restaurant', async () => {
      const res = await service.remove('rest-1');
      expect(restaurantsRepo.softDelete).toHaveBeenCalledWith('rest-1');
      expect(res.success).toBe(true);
    });
  });

  describe('setStatus', () => {
    it('updates the status and returns the restaurant', async () => {
      restaurantsRepo.findOne.mockResolvedValue(mockRestaurant({ status: RestaurantStatus.CLOSED }));
      const res = await service.setStatus('rest-1', RestaurantStatus.CLOSED);
      expect(restaurantsRepo.update).toHaveBeenCalledWith('rest-1', { status: RestaurantStatus.CLOSED });
      expect(res.status).toBe(RestaurantStatus.CLOSED);
    });
  });

  describe('findByOwner', () => {
    it('returns the restaurant owned by the given user', async () => {
      restaurantsRepo.findOne.mockResolvedValue(mockRestaurant({ ownerId: 'u-owner-1' }));
      const res = await service.findByOwner('u-owner-1');
      expect(restaurantsRepo.findOne).toHaveBeenCalledWith({ where: { ownerId: 'u-owner-1' } });
      expect(res.id).toBe('rest-1');
    });

    it('throws NotFoundException when the owner has no restaurant', async () => {
      restaurantsRepo.findOne.mockResolvedValue(null);
      await expect(service.findByOwner('u-no-restaurant')).rejects.toThrow(/no restaurant/i);
    });
  });
});
