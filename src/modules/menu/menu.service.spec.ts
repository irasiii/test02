import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { MenuService } from './menu.service';
import { MenuItem } from './entities/menu-item.entity';
import { MenuCategory } from './entities/menu-category.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import {
  CreateCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
} from './dtos/create-menu-item.dto';

describe('MenuService', () => {
  let service: MenuService;
  let itemsRepo: any;
  let catsRepo: any;
  let restaurants: any;

  const owner = { id: 'u-owner', isAdmin: false };
  const other = { id: 'u-other', isAdmin: false };
  const admin = { id: 'u-admin', isAdmin: true };

  beforeEach(async () => {
    itemsRepo = {
      create: jest.fn((x) => ({ ...x, id: 'item-new' })),
      save: jest.fn(async (x) => x),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
    catsRepo = {
      create: jest.fn((x) => ({ ...x, id: 'cat-new' })),
      save: jest.fn(async (x) => x),
      find: jest.fn(),
      findOne: jest.fn(),
      softDelete: jest.fn(),
    };
    restaurants = { assertOwned: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: getRepositoryToken(MenuItem), useValue: itemsRepo },
        { provide: getRepositoryToken(MenuCategory), useValue: catsRepo },
        { provide: RestaurantsService, useValue: restaurants },
      ],
    }).compile();
    service = moduleRef.get(MenuService);
  });

  describe('createCategory', () => {
    it('asserts ownership when an actor is supplied', async () => {
      await service.createCategory('r-1', { name: 'Mains' } as CreateCategoryDto, owner);
      expect(restaurants.assertOwned).toHaveBeenCalledWith('r-1', 'u-owner', false);
      expect(catsRepo.create).toHaveBeenCalled();
      expect(catsRepo.save).toHaveBeenCalled();
    });

    it('skips ownership when no actor is supplied', async () => {
      await service.createCategory('r-1', { name: 'Mains' } as CreateCategoryDto);
      expect(restaurants.assertOwned).not.toHaveBeenCalled();
    });

    it('rejects when the actor is forbidden', async () => {
      restaurants.assertOwned.mockRejectedValue(new ForbiddenException());
      await expect(
        service.createCategory('r-1', { name: 'Mains' } as CreateCategoryDto, other),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteCategory', () => {
    it('asserts ownership before deleting', async () => {
      catsRepo.findOne.mockResolvedValue({ id: 'c-1', restaurantId: 'r-1' });
      await service.deleteCategory('c-1', owner);
      expect(restaurants.assertOwned).toHaveBeenCalledWith('r-1', 'u-owner', false);
      expect(catsRepo.softDelete).toHaveBeenCalledWith('c-1');
    });

    it('throws NotFoundException for a missing category', async () => {
      catsRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteCategory('c-x', owner)).rejects.toThrow(/not found/i);
    });
  });

  describe('createItem', () => {
    it('asserts ownership and creates the item under a valid category', async () => {
      catsRepo.findOne.mockResolvedValue({ id: 'c-1', restaurantId: 'r-1' });
      const dto: CreateMenuItemDto = {
        categoryId: 'c-1',
        name: 'Burger',
        price: 9.5,
      } as CreateMenuItemDto;
      const res = await service.createItem('r-1', dto, owner);
      expect(restaurants.assertOwned).toHaveBeenCalledWith('r-1', 'u-owner', false);
      expect(itemsRepo.create).toHaveBeenCalled();
      expect(res.id).toBe('item-new');
    });

    it('throws NotFoundException when the category is missing', async () => {
      catsRepo.findOne.mockResolvedValue(null);
      const dto: CreateMenuItemDto = { categoryId: 'c-1', name: 'Burger', price: 9.5 } as CreateMenuItemDto;
      await expect(service.createItem('r-1', dto, owner)).rejects.toThrow(/category not found/i);
    });
  });

  describe('updateItem', () => {
    it('asserts ownership and updates the item', async () => {
      itemsRepo.findOne.mockResolvedValue({ id: 'i-1', restaurantId: 'r-1' });
      const dto: UpdateMenuItemDto = { price: 10.5 } as UpdateMenuItemDto;
      await service.updateItem('i-1', dto, owner);
      expect(restaurants.assertOwned).toHaveBeenCalledWith('r-1', 'u-owner', false);
      expect(itemsRepo.update).toHaveBeenCalledWith('i-1', dto);
    });
  });

  describe('deleteItem', () => {
    it('asserts ownership before deleting', async () => {
      itemsRepo.findOne.mockResolvedValue({ id: 'i-1', restaurantId: 'r-1' });
      await service.deleteItem('i-1', owner);
      expect(restaurants.assertOwned).toHaveBeenCalledWith('r-1', 'u-owner', false);
      expect(itemsRepo.softDelete).toHaveBeenCalledWith('i-1');
    });
  });

  describe('admin bypass', () => {
    it('allows an admin actor without owner checks failing', async () => {
      restaurants.assertOwned.mockRejectedValue(new ForbiddenException());
      // Re-wire: admin should pass. We simulate by resolving for admin.
      restaurants.assertOwned.mockImplementation(async (_id: string, _a: string, isAdmin: boolean) => {
        if (!isAdmin) throw new ForbiddenException();
      });
      catsRepo.findOne.mockResolvedValue({ id: 'c-1', restaurantId: 'r-1' });
      await expect(service.deleteCategory('c-1', admin)).resolves.toBeDefined();
    });
  });

  describe('read helpers', () => {
    it('listCategories returns items relations', async () => {
      catsRepo.find.mockResolvedValue([{ id: 'c-1' }]);
      const res = await service.listCategories('r-1');
      expect(catsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { restaurantId: 'r-1' } }),
      );
      expect(res.length).toBe(1);
    });

    it('findOne throws when item missing', async () => {
      itemsRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('i-x')).rejects.toThrow(/not found/i);
    });
  });
});
