import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Trip, TripStatus, TripType } from './entities/trip.entity';
import { Driver, DriverStatus } from '../drivers/entities/driver.entity';
import { RequestTripDto } from './dtos/request-trip.dto';
import { UpdateTripStatusDto } from './dtos/update-trip-status.dto';
import { GoogleMapsService } from '../../infra/google-maps/google-maps.service';
import { RedisService } from '../../infra/redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TrackingGateway } from '../tracking/tracking.gateway';

const NEARBY_RADIUS_KM = 5;

@Injectable()
export class TripsService {
  private readonly logger = new Logger('Trips');

  constructor(
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    private readonly maps: GoogleMapsService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
    private readonly tracking: TrackingGateway,
  ) {}

  // ----- Request -----

  async requestTrip(customerId: string, dto: RequestTripDto) {
    // 1) Look up distance + duration from pickup -> destination.
    const route = await this.maps.distanceMatrix(
      `${dto.pickupLat},${dto.pickupLng}`,
      `${dto.destinationLat},${dto.destinationLng}`,
    );

    const distanceMeters = route?.distanceMeters ?? 0;
    const durationSeconds = route?.durationSeconds ?? 0;

    // 2) Compute fare estimate using Uber-like formula.
    const fare = this.maps.estimateFare(distanceMeters, durationSeconds);
    const surge = 1.0; // could be computed from driver supply / demand

    const trip = this.trips.create({
      customerId,
      status: TripStatus.REQUESTED,
      type: dto.type ?? TripType.RIDE,
      pickupLat: dto.pickupLat,
      pickupLng: dto.pickupLng,
      pickupAddress: dto.pickupAddress,
      destinationLat: dto.destinationLat,
      destinationLng: dto.destinationLng,
      destinationAddress: dto.destinationAddress,
      distanceKm: Number((distanceMeters / 1000).toFixed(2)),
      durationSec: durationSeconds,
      fareEstimate: fare.subtotal,
      surgeMultiplier: surge,
      passengerCount: dto.passengerCount ?? 1,
      polyline: route?.polyline ?? null,
    });
    return this.trips.save(trip);
  }

  // ----- Driver accepts trip -----

  async acceptTrip(driverUserId: string, tripId: string) {
    const driver = await this.drivers.findOne({ where: { userId: driverUserId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    if (!driver.isApproved) throw new ForbiddenException('Driver not approved');
    if (driver.status !== DriverStatus.ONLINE) {
      throw new BadRequestException('Driver must be ONLINE to accept trips');
    }

    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status !== TripStatus.REQUESTED) {
      throw new BadRequestException(`Trip is already ${trip.status}`);
    }

    trip.driverId = driver.id;
    trip.status = TripStatus.ACCEPTED;
    trip.acceptedAt = new Date();
    driver.status = DriverStatus.ON_TRIP;
    await this.trips.save(trip);
    await this.drivers.save(driver);

    // Push notification + ws broadcast
    await this.notifications.sendToUser(
      trip.customerId,
      'Driver is on the way',
      'Your driver has accepted your ride',
      { tripId: trip.id, driverId: driver.id },
    );
    this.tracking.broadcastTripUpdate(trip.id, { status: trip.status, driverId: driver.id });
    this.tracking.broadcastDriverOffer(driver.id, { tripId: trip.id });
    return trip;
  }

  // ----- Status updates -----

  async updateStatus(actorUserId: string, tripId: string, dto: UpdateTripStatusDto) {
    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    const friend = await this.drivers.findOne({ where: { userId: actorUserId } });
    const isDriverOfTrip = friend && trip.driverId === friend.id;
    const isCustomer = trip.customerId === actorUserId;

    // Allow customer to cancel.
    if (dto.status === TripStatus.CANCELLED) {
      if (!isCustomer && !isDriverOfTrip) {
        throw new ForbiddenException('Not allowed to cancel this trip');
      }
      trip.status = TripStatus.CANCELLED;
      trip.cancelledAt = new Date();
      trip.cancelReason = dto.cancelReason ?? null;
      if (trip.driverId) {
        await this.drivers.update(trip.driverId, { status: DriverStatus.ONLINE });
      }
      return this.trips.save(trip);
    }

    // Drivers flow the trip forward.
    if (!isDriverOfTrip && !isCustomer) {
      throw new ForbiddenException('Not allowed to modify this trip');
    }

    switch (dto.status) {
      case TripStatus.DRIVER_ARRIVING:
      case TripStatus.DRIVER_ARRIVED:
        if (!isDriverOfTrip) throw new ForbiddenException('Only driver can update arrival status');
        break;
      case TripStatus.STARTED:
        if (!isDriverOfTrip) throw new ForbiddenException('Only the assigned driver can start the trip');
        trip.startedAt = new Date();
        break;
      case TripStatus.COMPLETED:
        if (!isDriverOfTrip) throw new ForbiddenException('Only the assigned driver can complete the trip');
        trip.completedAt = new Date();
        // Compute final fare based on actual distance.
        const actual = await this.maps.distanceMatrix(
          `${trip.pickupLat},${trip.pickupLng}`,
          `${trip.destinationLat},${trip.destinationLng}`,
        );
        if (actual) {
          trip.distanceKm = Number((actual.distanceMeters / 1000).toFixed(2));
          trip.durationSec = actual.durationSeconds;
          const fare = this.maps.estimateFare(actual.distanceMeters, actual.durationSeconds, trip.surgeMultiplier);
          trip.finalFare = fare.subtotal;
        } else {
          trip.finalFare = trip.fareEstimate;
        }
        if (trip.driverId) {
          await this.drivers.update(trip.driverId, { status: DriverStatus.ONLINE });
          await this.drivers.increment({ id: trip.driverId }, 'totalTrips', 1);
        }
        break;
    }

    trip.status = dto.status;
    const savedTrip = await this.trips.save(trip);
    this.tracking.broadcastTripUpdate(savedTrip.id, { status: savedTrip.status });
    if (dto.status === TripStatus.COMPLETED) {
      await this.notifications.sendToUser(savedTrip.customerId, 'Ride completed', `Final fare: $${savedTrip.finalFare}`, {
        tripId: savedTrip.id,
      });
    }
    return savedTrip;
  }

  // ----- Lookups -----

  /** Admin: list all trips with relations, newest first. */
  async listAll(limit = 100) {
    return this.trips.find({
      relations: ['customer', 'driver', 'driver.user'],
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 500),
    });
  }

  async getActiveForCustomer(customerId: string) {
    return this.trips.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async getActiveForDriver(driverUserId: string) {
    const driver = await this.drivers.findOne({ where: { userId: driverUserId } });
    if (!driver) return [];
    return this.trips.find({
      where: { driverId: driver.id },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async findOne(id: string) {
    const trip = await this.trips.findOne({
      where: { id },
      relations: ['customer', 'driver', 'driver.user'],
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  // ----- Match engine: find nearest available driver for a requested trip -----

  async findNearestDriverForTrip(trip: Trip): Promise<string | null> {
    const ids = await this.redis.nearby(
      'drivers:geo',
      trip.pickupLng,
      trip.pickupLat,
      NEARBY_RADIUS_KM,
      10,
    );
    if (!ids.length) return null;
    const onlineDrivers = await this.drivers.find({
      where: ids.map((r) => ({ id: r.member })),
    });
    const available = onlineDrivers.find(
      (d) =>
        d.status === DriverStatus.ONLINE &&
        (d.type === ('BOTH' as any) || d.type === ('RIDE' as any)),
    );
    return available?.id ?? null;
  }
}
