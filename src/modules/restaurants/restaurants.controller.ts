import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dtos/create-restaurant.dto';
import { UpdateRestaurantDto } from './dtos/update-restaurant.dto';
import { JwtAuthGuard } from '../../app/common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../app/common/decorators/current-user.decorator';
import { Roles, Role } from '../../app/common/decorators/roles.decorator';

@ApiTags('Restaurants')
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurants: RestaurantsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.RESTAURANT, Role.ADMIN)
  @ApiOperation({ summary: 'Register a restaurant (owner = caller)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRestaurantDto) {
    return this.restaurants.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all open restaurants (public)' })
  list(@Query('filter') filter?: string) {
    return this.restaurants.findAll({ filter });
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.RESTAURANT, Role.ADMIN)
  @ApiOperation({ summary: 'Get the restaurant owned by the current user' })
  getMine(@CurrentUser() user: AuthUser) {
    return this.restaurants.findByOwner(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one restaurant' })
  get(@Param('id') id: string) {
    return this.restaurants.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.RESTAURANT, Role.ADMIN)
  @ApiOperation({ summary: 'Update restaurant (owner or admin)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.restaurants.update(id, dto, user.id, (user as any).role === Role.ADMIN);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[Admin] Soft delete a restaurant' })
  remove(@Param('id') id: string) {
    return this.restaurants.remove(id, true);
  }
}
