import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';
import { googleMapsConfig } from './config/google-maps.config';
import { stripeConfig } from './config/stripe.config';
import { validateEnv } from './config/env.validation';

import { DatabaseModule } from '../infra/database/database.module';
import { RedisModule } from '../infra/redis/redis.module';
import { GoogleMapsModule } from '../infra/google-maps/google-maps.module';
import { StripeModule } from '../infra/stripe/stripe.module';
import { FcmModule } from '../infra/fcm/fcm.module';

import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { DriversModule } from '../modules/drivers/drivers.module';
import { RestaurantsModule } from '../modules/restaurants/restaurants.module';
import { MenuModule } from '../modules/menu/menu.module';
import { TripsModule } from '../modules/trips/trips.module';
import { OrdersModule } from '../modules/orders/orders.module';
import { PaymentsModule } from '../modules/payments/payments.module';
import { RatingsModule } from '../modules/ratings/ratings.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { TrackingModule } from '../modules/tracking/tracking.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, googleMapsConfig, stripeConfig],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    GoogleMapsModule,
    StripeModule,
    FcmModule,
    AuthModule,
    UsersModule,
    DriversModule,
    RestaurantsModule,
    MenuModule,
    TripsModule,
    OrdersModule,
    PaymentsModule,
    RatingsModule,
    NotificationsModule,
    TrackingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
