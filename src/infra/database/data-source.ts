import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

import { User } from '../../modules/users/entities/user.entity';
import { Driver, Vehicle } from '../../modules/drivers/entities/driver.entity';
import { Restaurant } from '../../modules/restaurants/entities/restaurant.entity';
import { MenuItem } from '../../modules/menu/entities/menu-item.entity';
import { MenuCategory } from '../../modules/menu/entities/menu-category.entity';
import { Trip } from '../../modules/trips/entities/trip.entity';
import { Order, OrderItem } from '../../modules/orders/entities/order.entity';
import { Payment } from '../../modules/payments/entities/payment.entity';
import { Rating } from '../../modules/ratings/entities/rating.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_DATABASE ?? 'geny_db',
  entities: [User, Driver, Vehicle, Restaurant, MenuCategory, MenuItem, Trip, Order, OrderItem, Payment, Rating],
  synchronize: true,
  logging: true,
});

export default AppDataSource;
