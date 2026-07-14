import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { Driver, Vehicle } from './entities/driver.entity';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../../infra/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, Vehicle]),
    AuthModule,
    RedisModule,
  ],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
