import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { ConfigService } from '@nestjs/config';

/**
 * Thin wrapper around `redis` v4 client.
 * Stores per-entity locations for nearby-driver queries and short-lived caching.
 *
 * NOTE: Coarse Redis GeoIndex uses the GEOADD/ZRANGEBY commands; we expose
 * setGeo/getNearby helpers for them.
 ********************/
@Injectable()
export class RedisService implements OnModuleInit {
  private client: RedisClientType;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.client = createClient({
      url: `redis://${this.config.get<string>('REDIS_HOST', 'localhost')}:${this.config.get<number>('REDIS_PORT', 6379)}`,
    });
    this.client.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('Redis error:', err);
    });
    await this.client.connect();
  }

  async set(key: string, value: string, ttlSec?: number) {
    if (ttlSec) await this.client.set(key, value, { EX: ttlSec });
    else await this.client.set(key, value);
  }

  async get<T = string>(key: string): Promise<T | null> {
    const val = await this.client.get(key);
    return val as unknown as T;
  }

  async del(key: string) {
    await this.client.del(key);
  }

  // Geo helpers used by tracking + drivers module
  async addGeo(key: string, longitude: number, latitude: number, member: string) {
    await this.client.geoAdd(key, { longitude, latitude, member });
  }

  async nearby(key: string, longitude: number, latitude: number, radiusKm: number, count = 10) {
    const res = await this.client.geoSearch(
      key,
      { longitude, latitude },
      { radius: radiusKm, unit: 'km' },
      { COUNT: count, SORT: 'ASC' },
    );
    // When no WITH* options are enabled, redis returns plain member strings.
    // To also get distance, callers can wrap the result with a follow-up ZRANGE if needed.
    if (!res || res.length === 0) return [];
    if (typeof res[0] === 'string') {
      return (res as string[]).map((member) => ({ member, distanceKm: null as number | null }));
    }
    // If `WITHDIST` is requested in the future, redis returns arrays.
    return (res as unknown as Array<string | Array<[unknown]>>).map((entry: any) => {
      if (Array.isArray(entry)) {
        return { member: entry[0] as string, distanceKm: Number(entry[1] ?? 0) };
      }
      return { member: entry as string, distanceKm: null as number | null };
    });
  }

  async removeGeo(key: string, member: string) {
    await this.client.zRem(key, member);
  }
}
