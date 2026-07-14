import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Message = {
  token?: string;
  topic?: string;
  notification?: { title: string; body: string };
  data?: Record<string, string>;
  android?: any;
  apns?: any;
};

/**
 * Wraps Firebase Admin SDK to send FCM push notifications.
 * Falls back to "no-op" (with warning) when Firebase env vars are missing so the
 * rest of the application still runs during local development.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger('Fcm');
  private admin: typeof import('firebase-admin') | null = null;
  private initialized = false;

  constructor(private config: ConfigService) {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    if (projectId && privateKey && clientEmail) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.admin = require('firebase-admin');
      this.admin.initializeApp({
        credential: this.admin.credential.cert({ projectId, privateKey, clientEmail }),
      });
      this.initialized = true;
    } else {
      this.logger.warn('Firebase env not configured — push notifications disabled (dev mode).');
    }
  }

  async send(message: Message): Promise<string | null> {
    if (!this.initialized || !this.admin) {
      this.logger.debug(`(noop) Would send push: ${message.notification?.title ?? ''}`);
      return null;
    }
    try {
      return await this.admin.messaging().send(message as any);
    } catch (err) {
      this.logger.error(`FCM send failed: ${(err as Error).message}`);
      return null;
    }
  }

  async sendToToken(
    token: string,
    title: string,
    body: string,
    data: Record<string, string> = {},
  ) {
    return this.send({ token, notification: { title, body }, data });
  }

  async sendToTopic(topic: string, title: string, body: string, data: Record<string, string> = {}) {
    return this.send({ topic, notification: { title, body }, data });
  }
}
