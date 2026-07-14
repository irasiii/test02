import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Rating, RatingTarget } from './entities/rating.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { CreateRatingDto } from './dtos/create-rating.dto';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating) private readonly ratings: Repository<Rating>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Restaurant) private readonly restaurants: Repository<Restaurant>,
  ) {}

  async create(reviewerId: string, dto: CreateRatingDto) {
    if (dto.stars < 1 || dto.stars > 5) throw new BadRequestException('Stars must be 1..5');

    const rating = this.ratings.create({
      reviewerId,
      targetId: dto.targetId,
      target: dto.target,
      stars: dto.stars,
      title: dto.title ?? null,
      comment: dto.comment ?? null,
      tags: dto.tags ?? [],
      referenceId: dto.referenceId ?? null,
    });
    const saved = await this.ratings.save(rating);

    // Recompute aggregate rating for the entity.
    await this.recomputeTargetRating(dto.target, dto.targetId);
    return saved;
  }

  async findByTarget(target: RatingTarget, targetId: string) {
    return this.ratings.find({
      where: { target, targetId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findByReviewer(reviewerId: string) {
    return this.ratings.find({
      where: { reviewerId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  private async recomputeTargetRating(target: RatingTarget, targetId: string) {
    if (target === RatingTarget.DRIVER) {
      const { avg, count } = await this.ratings
        .createQueryBuilder('r')
        .select('AVG(r.stars)', 'avg')
        .addSelect('COUNT(*)', 'count')
        .where('r.target = :t', { t: RatingTarget.DRIVER })
        .andWhere('r.target_id = :id', { id: targetId })
        .getRawOne<{ avg: string; count: string }>();
      if (avg) {
        await this.drivers.update(targetId, {
          rating: Number(Number(avg).toFixed(2)),
        });
      }
    }
    if (target === RatingTarget.RESTAURANT) {
      const { avg, count } = await this.ratings
        .createQueryBuilder('r')
        .select('AVG(r.stars)', 'avg')
        .addSelect('COUNT(*)', 'count')
        .where('r.target = :t', { t: RatingTarget.RESTAURANT })
        .andWhere('r.target_id = :id', { id: targetId })
        .getRawOne<{ avg: string; count: string }>();
      if (avg) {
        await this.restaurants.update(targetId, {
          rating: Number(Number(avg).toFixed(2)),
          ratingCount: Number(count) ?? 0,
        });
      }
    }
  }
}
