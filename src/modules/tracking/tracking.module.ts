import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TrackingGateway } from './tracking.gateway';
import { RedisModule } from '../../infra/redis/redis.module';
import { Driver } from '../drivers/entities/driver.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver]),
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret', 'super-secret-change-me'),
      }),
    }),
  ],
  providers: [TrackingGateway],
  exports: [TrackingGateway],
})
export class TrackingModule {}
