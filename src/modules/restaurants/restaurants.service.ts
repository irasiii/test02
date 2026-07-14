import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Restaurant, RestaurantStatus } from './entities/restaurant.entity';
import { CreateRestaurantDto } from './dtos/create-restaurant.dto';
import { UpdateRestaurantDto } from './dtos/update-restaurant.dto';

@Injectable()
export class RestaurantsService {
  constructor(@InjectRepository(Restaurant) private readonly restaurants: Repository<Restaurant>) {}

  async create(dto: CreateRestaurantDto) {
    const restaurant = this.restaurants.create({
      ...dto,
      status: RestaurantStatus.OPEN,
      rating: 0,
      ratingCount: 0,
      estimatedPrepMinutes: 20,
      isActive: true,
    });
    return this.restaurants.save(restaurant);
  }

  async findAll(opts: { filter?: string } = {}) {
    const qb = this.restaurants.createQueryBuilder('r').where('r.is_active = :active', {
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

  async update(id: string, dto: UpdateRestaurantDto) {
    await this.restaurants.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.restaurants.softDelete(id);
    return { success: true };
  }

  async setStatus(id: string, status: RestaurantStatus) {
    await this.restaurants.update(id, { status });
    return this.findOne(id);
  }
}
