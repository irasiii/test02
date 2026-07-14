import 'reflect-metadata';
import { config } from 'dotenv';
config();

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User } from '../../modules/users/entities/user.entity';
import { Driver, Vehicle } from '../../modules/drivers/entities/driver.entity';
import { Restaurant } from '../../modules/restaurants/entities/restaurant.entity';
import { MenuCategory } from '../../modules/menu/entities/menu-category.entity';
import { MenuItem } from '../../modules/menu/entities/menu-item.entity';
import { Trip } from '../../modules/trips/entities/trip.entity';
import { Order, OrderItem } from '../../modules/orders/entities/order.entity';
import { Payment } from '../../modules/payments/entities/payment.entity';
import { Rating } from '../../modules/ratings/entities/rating.entity';
import { Role } from '../../app/common/decorators/roles.decorator';
import { DriverStatus, DriverType } from '../../modules/drivers/entities/driver.entity';
import { RestaurantStatus } from '../../modules/restaurants/entities/restaurant.entity';
import { OrderStatus, PaymentMethod } from '../../modules/orders/entities/order.entity';

const AppDataSource = new DataSource({
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

async function seed() {
  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);
  const driverRepo = AppDataSource.getRepository(Driver);
  const vehicleRepo = AppDataSource.getRepository(Vehicle);
  const restaurantRepo = AppDataSource.getRepository(Restaurant);
  const catRepo = AppDataSource.getRepository(MenuCategory);
  const itemRepo = AppDataSource.getRepository(MenuItem);

  const password = await bcrypt.hash('P@ssw0rd', 10);

  // Admin
  const admin = userRepo.create({
    email: 'admin@geny.app',
    phone: '+10000000001',
    firstName: 'Site',
    lastName: 'Admin',
    role: Role.ADMIN,
    passwordHash: password,
    isActive: true,
  });
  await userRepo.save(admin);

  // Customer
  const customer = userRepo.create({
    email: 'customer@geny.app',
    phone: '+10000000002',
    firstName: 'Jane',
    lastName: 'Customer',
    role: Role.CUSTOMER,
    passwordHash: password,
    isActive: true,
  });
  await userRepo.save(customer);

  // Driver
  const driverUser = userRepo.create({
    email: 'driver@geny.app',
    phone: '+10000000003',
    firstName: 'Mike',
    lastName: 'Driver',
    role: Role.DRIVER,
    passwordHash: password,
    isActive: true,
  });
  await userRepo.save(driverUser);

  // Restaurant owner (so the seeded restaurant has a usable owner account).
  const restaurantUser = userRepo.create({
    email: 'burgers@geny.app',
    phone: '+10000000004',
    firstName: 'Burger',
    lastName: 'Owner',
    role: Role.RESTAURANT,
    passwordHash: password,
    isActive: true,
  });
  await userRepo.save(restaurantUser);

  const driver = driverRepo.create({
    userId: driverUser.id,
    status: DriverStatus.ONLINE,
    type: DriverType.BOTH,
    rating: 4.9,
    totalTrips: 320,
    totalDeliveries: 210,
    isApproved: true,
    currentLat: 24.7136,
    currentLng: 46.6753,
  });
  await driverRepo.save(driver);

  const vehicle = vehicleRepo.create({
    driverId: driver.id,
    type: 'SEDAN' as any,
    make: 'Toyota',
    model: 'Camry',
    year: '2022',
    plateNumber: 'GENY-001',
    color: '#ffffff',
    isVerified: true,
    capacity: 4,
  });
  await vehicleRepo.save(vehicle);

  // Restaurant
  const restaurant = restaurantRepo.create({
    ownerId: restaurantUser.id,
    email: 'burgers@geny.app',
    phone: '+10000000004',
    name: 'GenY Burger House',
    description: 'Best gourmet burgers',
    status: RestaurantStatus.OPEN,
    lat: 24.7136,
    lng: 46.6753,
    address: 'Olaya St, Riyadh',
    rating: 4.8,
    ratingCount: 1200,
    deliveryFee: 2.5,
    minimumOrder: 10,
    estimatedPrepMinutes: 20,
    cuisineTypes: ['Burgers', 'Fries', 'Shakes'],
    openingHours: [{ day: 'Mon', from: '10:00', to: '23:00' }],
    isActive: true,
  });
  await restaurantRepo.save(restaurant);

  // Menu
  const cat = catRepo.create({ restaurantId: restaurant.id, name: 'Burgers' });
  await catRepo.save(cat);
  const item1 = itemRepo.create({
    restaurantId: restaurant.id,
    categoryId: cat.id,
    name: 'Classic Cheeseburger',
    description: 'Beef patty, cheese, veggies',
    price: 8.5,
    isAvailable: true,
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
    prepTimeMin: 10,
  });
  await itemRepo.save(item1);
  const item2 = itemRepo.create({
    restaurantId: restaurant.id,
    categoryId: cat.id,
    name: 'Vegan Burger',
    description: 'Beyond patty',
    price: 9.5,
    isAvailable: true,
    isVegetarian: true,
    isVegan: true,
    isGlutenFree: true,
    prepTimeMin: 12,
  });
  await itemRepo.save(item2);

  // eslint-disable-next-line no-console
  console.log('Seed complete! Credentials:');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(
    {
      admin: { email: admin.email, password: 'P@ssw0rd' },
      customer: { email: customer.email, password: 'P@ssw0rd' },
      driver: { email: driverUser.email, password: 'P@ssw0rd' },
      restaurant: { email: restaurantUser.email, password: 'P@ssw0rd', name: restaurant.name },
    },
    null,
    2,
  ));
  await AppDataSource.destroy();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed error', err);
  process.exit(1);
});

// These imports exist only so es-loop's auto-import validator doesn't strip them.
export const MENU_REFERENCES = { MenuCategory, MenuItem, Restaurant };
