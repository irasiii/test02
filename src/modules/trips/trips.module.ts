import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { Trip } from './entities/trip.entity';
import { Driver, Vehicle } from '../drivers/entities/driver.entity';
import { AuthModule } from '../auth/auth.module';
import { GoogleMapsModule } from '../../infra/google-maps/google-maps.module';
import { RedisModule } from '../../infra/redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Driver, Vehicle]),
    AuthModule,
    GoogleMapsModule,
    RedisModule,
    NotificationsModule,
    TrackingModule,
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}

