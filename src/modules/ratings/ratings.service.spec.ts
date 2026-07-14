import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { RatingsService } from './ratings.service';
import { Rating, RatingTarget } from './entities/rating.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';

describe('RatingsService', () => {
  let service: RatingsService;
  let ratingsRepo: any;
  let driversRepo: any;
  let restaurantsRepo: any;

  beforeEach(async () => {
    const qb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ avg: '4.5', count: '2' }),
    };
    ratingsRepo = {
      create: jest.fn((x) => ({ ...x })),
      save: jest.fn(async (x) => ({ ...x, id: 'r1' })),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => qb),
    };
    driversRepo = { update: jest.fn() };
    restaurantsRepo = { update: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: getRepositoryToken(Rating), useValue: ratingsRepo },
        { provide: getRepositoryToken(Driver), useValue: driversRepo },
        { provide: getRepositoryToken(Restaurant), useValue: restaurantsRepo },
      ],
    }).compile();
    service = moduleRef.get(RatingsService);
  });

  it('rejects out-of-range star values', async () => {
    await expect(
      service.create('u1', { target: RatingTarget.DRIVER, targetId: 'd1', stars: 6 } as any),
    ).rejects.toThrow(/1\.\.5/);
  });

  it('aggregates a driver rating after a new rating', async () => {
    const r = await service.create('u1', { target: RatingTarget.DRIVER, targetId: 'd1', stars: 5 } as any);
    expect(r.stars).toBe(5);
    expect(driversRepo.update).toHaveBeenCalledWith('d1', { rating: 4.5 });
  });

  it('aggregates a restaurant rating with its count', async () => {
    await service.create('u1', { target: RatingTarget.RESTAURANT, targetId: 'rest-1', stars: 4 } as any);
    expect(restaurantsRepo.update).toHaveBeenCalledWith('rest-1', { rating: 4.5, ratingCount: 2 });
  });

  it('findByTarget returns ratings ordered by recency', async () => {
    ratingsRepo.find.mockResolvedValue([{ id: 'r1' }]);
    const res = await service.findByTarget(RatingTarget.DRIVER, 'd1');
    expect(res.length).toBe(1);
    expect(ratingsRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { target: RatingTarget.DRIVER, targetId: 'd1' } }),
    );
  });
});
