import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../modules/users/entities/user.entity';
import { Driver, Vehicle } from '../../modules/drivers/entities/driver.entity';
import { Restaurant } from '../../modules/restaurants/entities/restaurant.entity';
import { MenuItem } from '../../modules/menu/entities/menu-item.entity';
import { MenuCategory } from '../../modules/menu/entities/menu-category.entity';
import { Trip } from '../../modules/trips/entities/trip.entity';
import { Order, OrderItem } from '../../modules/orders/entities/order.entity';
import { Payment } from '../../modules/payments/entities/payment.entity';
import { Rating } from '../../modules/ratings/entities/rating.entity';

const ENTITIES = [User, Driver, Vehicle, Restaurant, MenuCategory, MenuItem, Trip, Order, OrderItem, Payment, Rating];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        entities: ENTITIES,
        synchronize: config.get<boolean>('database.synchronize'),
        logging: config.get<boolean>('database.logging'),
        autoLoadEntities: true,
      }),
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
