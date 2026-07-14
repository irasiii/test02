import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Restaurant, RestaurantStatus } from './entities/restaurant.entity';
import { CreateRestaurantDto } from './dtos/create-restaurant.dto';
import { UpdateRestaurantDto } from './dtos/update-restaurant.dto';

@Injectable()
export class RestaurantsService {
  constructor(@InjectRepository(Restaurant) private readonly restaurants: Repository< Restaurant>) {}

  async create(dto: CreateRestaurantDto, ownerId?: string) {
    const restaurant = this.restaurants.create({
      ...dto,
      ownerId: ownerId ?? null,
      status: RestaurantStatus.OPEN,
      rating: 0,
      ratingCount: 0,
      estimatedPrepMinutes: 20,
      isActive: true,
    });
    return this.restaurants.save(restaurant);
  }

  async findAll(opts: { filter?: string } = {}) {
    const qb = this.restaurants.createQueryBuilder('r').where('r.isActive = :active', {
      active: true,
    });
    if (opts.filter) {
      qb.andWhere('(r.name ILIKE :q OR :q = ANY(r.cuisine_types))', { q: `%${opts.filter}%` });
    }
    qb.orderBy('r.rating', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string) {
    const r = await this.restaurants.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Restaurant not found');
    return r;
  }

  async findByOwner(ownerId: string) {
    const r = await this.restaurants.findOne({ where: { ownerId } });
    if (!r) throw new NotFoundException('No restaurant found for this owner');
    return r;
  }

  /** Asserts the actor owns the restaurant (admin bypasses). */
  async assertOwned(id: string, actorId: string, isAdmin: boolean) {
    const r = await this.findOne(id);
    if (!isAdmin && r.ownerId !== actorId) {
      throw new ForbiddenException('You do not own this restaurant');
    }
    return r;
  }

  async update(id: string, dto: UpdateRestaurantDto, actorId?: string, isAdmin = false) {
    if (actorId) await this.assertOwned(id, actorId, isAdmin);
    await this.restaurants.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string, isAdmin = true) {
    await this.restaurants.softDelete(id);
    return { success: true };
  }

  async setStatus(id: string, status: RestaurantStatus) {
    await this.restaurants.update(id, { status });
    return this.findOne(id);
  }
}

