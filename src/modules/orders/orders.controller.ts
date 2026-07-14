import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dtos/create-order.dto';
import { UpdateOrderStatusDto } from './dtos/update-order-status.dto';
import { JwtAuthGuard } from '../../app/common/guards/jwt-auth.guard';
import { Roles, Role } from '../../app/common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../app/common/decorators/current-user.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Place a food delivery order' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: list all orders' })
  listAll() {
    return this.orders.listAll();
  }

  @Get('me')
  @ApiOperation({ summary: "List the customer's recent orders" })
  listMine(@CurrentUser() user: AuthUser) {
    return this.orders.listMine(user.id);
  }

  @Get('restaurant/:restaurantId')
  @ApiOperation({ summary: 'Restaurant lists incoming orders (owner or admin)' })
  listForRestaurant(@CurrentUser() user: AuthUser, @Param('restaurantId') rid: string) {
    return this.orders.listForRestaurant(rid, {
      id: user.id,
      isAdmin: (user as any).role === 'ADMIN',
    });
  }

  @Get('driver')
  @ApiOperation({ summary: "List the driver's assigned deliveries" })
  listForDriver(@CurrentUser() user: AuthUser) {
    return this.orders.listForDriver(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single order with relations' })
  get(@Param('id') id: string) {
    return this.orders.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status (restaurant / driver / customer)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(user.id, id, dto, (user as any).role === 'ADMIN');
  }
}
