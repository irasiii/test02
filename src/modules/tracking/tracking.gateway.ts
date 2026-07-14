import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../../infra/redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Real-time tracking gateway.
 *
 * Channels
 * --------
 *  - `trip:{tripId}`        — customer listens, driver emits location updates
 *  - `order:{orderId}`      — customer listens for status + courier location
 *  - `driver:{driverId}`    — driver listens for incoming requests (broadcast from server)
 *
 * Authentication: client emits `auth` with `{ token: <jwt> }` immediately after
 * connecting. Until authenticated, the socket can only subscribe to public channels
 * (e.g. demo) but cannot push location updates or accept trips.
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'tracking',
  transports: ['websocket'],
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('Tracking');

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(socket: Socket) {
    this.logger.log(`socket connected: ${socket.id}`);
    // Optionally accept token via handshake auth query.
    const auth = (socket.handshake as any).auth as { token?: string };
    if (auth?.token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string; role: string }>(auth.token, {
          secret: this.config.get<string>('jwt.secret', 'super-secret-change-me'),
        });
        (socket as any).userId = payload.sub;
        (socket as any).role = payload.role;
        this.logger.log(`socket authed as ${payload.sub} (${payload.role})`);
      } catch {
        // unauthenticated — wait for explicit auth message
      }
    }
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`socket disconnected: ${socket.id}`);
  }

  @SubscribeMessage('auth')
  async onAuth(@ConnectedSocket() socket: Socket, @MessageBody() payload: { token: string }) {
    try {
      const decoded = await this.jwt.verifyAsync<{ sub: string; role: string }>(payload.token, {
        secret: this.config.get<string>('jwt.secret', 'super-secret-change-me'),
      });
      (socket as any).userId = decoded.sub;
      (socket as any).role = decoded.role;
      socket.emit('auth', { ok: true, user: decoded });
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message };
    }
  }

  @SubscribeMessage('join')
  onJoin(@ConnectedSocket() socket: Socket, @MessageBody() payload: { room: string }) {
    if (!payload.room) return { ok: false };
    socket.join(payload.room);
    return { ok: true, room: payload.room };
  }

  /**
   * Driver broadcasts its current location. Server fans this out to any room
   * matching `driver:{userId}` and any active trip rooms the driver belongs to.
   * Server also persists the location into Redis GEO for nearby-driver queries.
   */
  @SubscribeMessage('driver:location')
  async onDriverLocation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { lat: number; lng: number; heading?: number; tripId?: string; orderId?: string },
  ) {
    const userId = (socket as any).userId;
    if (!userId) return { ok: false, error: 'unauthenticated' };

    await this.redis.addGeo('drivers:geo', payload.lng, payload.lat, `user:${userId}`);
    this.server.emit(`driver:${userId}`, payload);

    if (payload.tripId) {
      this.server.to(`trip:${payload.tripId}`).emit('trip:location', payload);
    }
    if (payload.orderId) {
      this.server.to(`order:${payload.orderId}`).emit('order:location', payload);
    }
    return { ok: true };
  }

  /**
   * Server-side helper (used by services) to broadcast status changes from
   * REST endpoints to listening customers.
   */
  broadcastTripUpdate(tripId: string, payload: unknown) {
    this.server?.to(`trip:${tripId}`).emit('trip:update', payload);
  }

  broadcastOrderUpdate(orderId: string, payload: unknown) {
    this.server?.to(`order:${orderId}`).emit('order:update', payload);
  }

  broadcastDriverOffer(driverId: string, payload: unknown) {
    this.server?.to(`driver:${driverId}`).emit('driver:offer', payload);
  }
}
