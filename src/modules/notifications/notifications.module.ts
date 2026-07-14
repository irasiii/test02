import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationsService } from './notifications.service';
import { User } from '../users/entities/user.entity';
import { FcmModule } from '../../infra/fcm/fcm.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), FcmModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
