import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { FcmService } from '../../infra/fcm/fcm.service';

/**
 * Push notification service that resolves the user's FCM token and dispatches
 * the message via Firebase Admin SDK. Falls back to a debug log when FCM is
 * unavailable (typical during local development).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly fcm: FcmService,
  ) {}

  async sendToUser(userId: string, title: string, body: string, data: Record<string, string> = {}) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`Notification skipped: user ${userId} not found`);
      return null;
    }
    if (!user.fcmToken) {
      this.logger.debug(`Notification skipped: user ${userId} has no FCM token`);
      return null;
    }
    return this.fcm.sendToToken(user.fcmToken, title, body, data);
  }

  async sendToTopic(topic: string, title: string, body: string, data: Record<string, string> = {}) {
    return this.fcm.sendToTopic(topic, title, body, data);
  }
}
