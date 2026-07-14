import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, OrderItem } from './entities/order.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { AuthModule } from '../auth/auth.module';
import { GoogleMapsModule } from '../../infra/google-maps/google-maps.module';
import { RedisModule } from '../../infra/redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Restaurant, MenuItem, Driver]),
    AuthModule,
    GoogleMapsModule,
    RedisModule,
    NotificationsModule,
    TrackingModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
