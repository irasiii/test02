import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { MenuService } from './menu.service';
import {
  CreateCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
} from './dtos/create-menu-item.dto';
import { JwtAuthGuard } from '../../app/common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../app/common/decorators/current-user.decorator';
import { Roles, Role } from '../../app/common/decorators/roles.decorator';

@ApiTags('Menu')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('restaurants/:restaurantId')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  private actor(user: AuthUser) {
    return { id: user.id, isAdmin: (user as any).role === Role.ADMIN };
  }

  // Categories --------------------------------------------------------------

  @Post('categories')
  @Roles(Role.RESTAURANT, Role.ADMIN)
  @ApiOperation({ summary: 'Add a menu category (owner or admin)' })
  createCategory(@CurrentUser() user: AuthUser, @Param('restaurantId') rid: string, @Body() dto: CreateCategoryDto) {
    return this.menu.createCategory(rid, dto, this.actor(user));
  }

  @Get('categories')
  @ApiOperation({ summary: 'List menu categories (with items)' })
  listCategories(@Param('restaurantId') rid: string) {
    return this.menu.listCategories(rid);
  }

  @Delete('categories/:id')
  @Roles(Role.RESTAURANT, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a menu category (owner or admin)' })
  deleteCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.menu.deleteCategory(id, this.actor(user));
  }

  // Items -------------------------------------------------------------------

  @Post('items')
  @Roles(Role.RESTAURANT, Role.ADMIN)
  @ApiOperation({ summary: 'Add an item to the menu (owner or admin)' })
  createItem(@CurrentUser() user: AuthUser, @Param('restaurantId') rid: string, @Body() dto: CreateMenuItemDto) {
    return this.menu.createItem(rid, dto, this.actor(user));
  }

  @Get('items')
  @ApiOperation({ summary: 'List all menu items' })
  listItems(@Param('restaurantId') rid: string) {
    return this.menu.listItems(rid);
  }

  @Patch('items/:id')
  @Roles(Role.RESTAURANT, Role.ADMIN)
  @ApiOperation({ summary: 'Update a menu item (owner or admin)' })
  updateItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menu.updateItem(id, dto, this.actor(user));
  }

  @Delete('items/:id')
  @Roles(Role.RESTAURANT, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a menu item (owner or admin)' })
  deleteItem(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.menu.deleteItem(id, this.actor(user));
  }
}

