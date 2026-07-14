import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';

import { Driver, DriverStatus, DriverType } from './entities/driver.entity';
import { Vehicle, VehicleType } from './entities/vehicle.entity';
import { CreateVehicleDto } from './dtos/create-vehicle.dto';
import { UpdateLocationDto } from './dtos/update-location.dto';
import { UpdateDriverDto } from './dtos/update-driver.dto';
import { RedisService } from '../../infra/redis/redis.service';

const GEO_KEY = 'drivers:geo';

@Injectable()
export class DriversService {
  private readonly logger = new Logger('Drivers');

  constructor(
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly redis: RedisService,
  ) {}

  async findByUserId(userId: string): Promise<Driver> {
    const driver = await this.drivers.findOne({ where: { userId }, relations: ['vehicles'] });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return driver;
  }

  async findOne(id: string) {
    const d = await this.drivers.findOne({
      where: { id },
      relations: ['user', 'vehicles'],
    });
    if (!d) throw new NotFoundException('Driver not found');
    return d;
  }

  async list() {
    return this.drivers.find({ relations: ['user'], order: { createdAt: 'DESC' } });
  }

  async update(userId: string, dto: UpdateDriverDto) {
    const driver = await this.findByUserId(userId);
    Object.assign(driver, dto);
    await this.drivers.save(driver);
    return this.findOne(driver.id);
  }

  async goOnline(userId: string): Promise<Driver> {
    const driver = await this.findByUserId(userId);
    if (!driver.isApproved) throw new ForbiddenException('Driver not approved yet');
    driver.status = DriverStatus.ONLINE;
    driver.lastSeenAt = new Date();
    await this.drivers.save(driver);
    await this.redis.addGeo(GEO_KEY, driver.currentLng, driver.currentLat, driver.id);
    return driver;
  }

  async goOffline(userId: string): Promise<Driver> {
    const driver = await this.findByUserId(userId);
    driver.status = DriverStatus.OFFLINE;
    await this.drivers.save(driver);
    await this.redis.del(`driver:ping:${driver.id}`);
    await this.redis.removeGeo(GEO_KEY, driver.id);
    return driver;
  }

  async pingLocation(userId: string, dto: UpdateLocationDto) {
    const driver = await this.findByUserId(userId);
    if (driver.status === DriverStatus.OFFLINE) {
      throw new BadRequestException('Driver is offline');
    }
    driver.currentLat = dto.lat;
    driver.currentLng = dto.lng;
    driver.lastSeenAt = new Date();
    await this.drivers.save(driver);
    await this.redis.addGeo(GEO_KEY, dto.lng, dto.lat, driver.id);
    // short-lived ping heartbeat used by the matching engine
    await this.redis.set(`driver:ping:${driver.id}`, String(Date.now()), 30);
    return { updated: true };
  }

  async nearby(lat: number, lng: number, radiusKm = 5, count = 10) {
    const ids = await this.redis.nearby(GEO_KEY, lng, lat, radiusKm, count);
    if (!ids.length) return [];
    const drivers = await this.drivers.find({
      where: ids.map((r) => ({ id: r.member })),
    });
    return drivers.map((d) => ({
      id: d.id,
      lat: d.currentLat,
      lng: d.currentLng,
      rating: d.rating,
      type: d.type,
      distanceKm: ids.find((r) => r.member === d.id)?.distanceKm ?? null,
    }));
  }

  // Vehicles ---------------------------------------------------------------

  async addVehicle(userId: string, dto: CreateVehicleDto): Promise<Vehicle> {
    const driver = await this.findByUserId(userId);
    const exists = await this.vehicles.findOne({
      where: { plateNumber: dto.plateNumber },
    });
    if (exists) throw new ConflictException('Plate number already registered');
    const vehicle = this.vehicles.create({ ...dto, driverId: driver.id, capacity: dto.capacity ?? 4 });
    return this.vehicles.save(vehicle);
  }

  async listVehicles(userId: string) {
    const driver = await this.findByUserId(userId);
    return this.vehicles.find({ where: { driverId: driver.id } });
  }

  async verifyVehicle(userId: string, vehicleId: string) {
    const vehicle = await this.vehicles.findOne({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const driver = await this.drivers.findOne({ where: { id: vehicle.driverId } });
    if (!driver || driver.userId !== userId) throw new ForbiddenException('Not your vehicle');
    vehicle.isVerified = true;
    await this.vehicles.save(vehicle);
    return vehicle;
  }
}
