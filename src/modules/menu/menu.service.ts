import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MenuItem } from './entities/menu-item.entity';
import { MenuCategory } from './entities/menu-category.entity';
import {
  CreateCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
} from './dtos/create-menu-item.dto';
import { RestaurantsService } from '../restaurants/restaurants.service';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem) private readonly items: Repository<MenuItem>,
    @InjectRepository(MenuCategory) private readonly categories: Repository<MenuCategory>,
    private readonly restaurants: RestaurantsService,
  ) {}

  // Categories --------------------------------------------------------------

  async createCategory(restaurantId: string, dto: CreateCategoryDto, actor?: { id: string; isAdmin: boolean }) {
    if (actor) await this.restaurants.assertOwned(restaurantId, actor.id, actor.isAdmin);
    const cat = this.categories.create({ ...dto, restaurantId });
    return this.categories.save(cat);
  }

  async listCategories(restaurantId: string) {
    return this.categories.find({
      where: { restaurantId },
      relations: ['items'],
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async deleteCategory(id: string, actor?: { id: string; isAdmin: boolean }) {
    const cat = await this.categories.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    if (actor) await this.restaurants.assertOwned(cat.restaurantId, actor.id, actor.isAdmin);
    await this.categories.softDelete(id);
    return { success: true };
  }

  // Items -------------------------------------------------------------------

  async createItem(restaurantId: string, dto: CreateMenuItemDto, actor?: { id: string; isAdmin: boolean }) {
    if (actor) await this.restaurants.assertOwned(restaurantId, actor.id, actor.isAdmin);
    const cat = await this.categories.findOne({
      where: { id: dto.categoryId, restaurantId },
    });
    if (!cat) throw new NotFoundException('Category not found for this restaurant');
    const item = this.items.create({
      ...dto,
      restaurantId,
    });
    return this.items.save(item);
  }

  async listItems(restaurantId: string) {
    return this.items.find({
      where: { restaurantId },
      relations: ['category'],
      order: { createdAt: 'ASC' },
    });
  }

  async updateItem(id: string, dto: UpdateMenuItemDto, actor?: { id: string; isAdmin: boolean }) {
    const item = await this.findOne(id);
    if (actor) await this.restaurants.assertOwned(item.restaurantId, actor.id, actor.isAdmin);
    await this.items.update(id, dto);
    return this.findOne(id);
  }

  async deleteItem(id: string, actor?: { id: string; isAdmin: boolean }) {
    const item = await this.findOne(id);
    if (actor) await this.restaurants.assertOwned(item.restaurantId, actor.id, actor.isAdmin);
    await this.items.softDelete(id);
    return { success: true };
  }

  async findOne(id: string) {
    const item = await this.items.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }
}

