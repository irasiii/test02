import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { Driver, DriverStatus, DriverType } from '../drivers/entities/driver.entity';
import { Role } from '../../app/common/decorators/roles.decorator';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: any;
  let driversRepo: any;
  let jwt: any;
  let config: any;

  const mockUser = (over: Record<string, any> = {}) => ({
    id: 'u1',
    email: 'test@example.com',
    phone: '+1234567890',
    firstName: 'John',
    lastName: 'Doe',
    role: Role.CUSTOMER,
    passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    isActive: true,
    fcmToken: null,
    walletBalance: 0,
    ...over,
  });

  beforeEach(async () => {
    usersRepo = {
      create: jest.fn((x) => ({ ...x, id: 'u-new' })),
      save: jest.fn(async (x) => x),
      findOne: jest.fn(),
    };
    driversRepo = {
      create: jest.fn((x) => ({ ...x, id: 'drv-new' })),
      save: jest.fn(async (x) => x),
    };
    jwt = {
      signAsync: jest.fn(async () => 'mock-token'),
      verify: jest.fn(),
    };
    config = {
      get: jest.fn((key: string, fallback: string) => fallback),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Driver), useValue: driversRepo },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('creates a new customer by default', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      const res = await service.register({
        email: 'new@example.com',
        phone: '+1111111111',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'pass123',
      } as any);

      expect(usersRepo.create).toHaveBeenCalled();
      expect(usersRepo.save).toHaveBeenCalled();
      expect(res.accessToken).toBe('mock-token');
      expect(res.user.role).toBe(Role.CUSTOMER);
    });

    it('creates a driver record when role is DRIVER', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await service.register({
        email: 'driver@example.com',
        phone: '+2222222222',
        firstName: 'Bob',
        lastName: 'Driver',
        password: 'pass123',
        role: Role.DRIVER,
      } as any);

      expect(driversRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: DriverStatus.OFFLINE,
          isApproved: false,
        }),
      );
      expect(driversRepo.save).toHaveBeenCalled();
    });

    it('throws ConflictException for duplicate email or phone', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser());

      await expect(
        service.register({
          email: 'test@example.com',
          phone: '+1234567890',
          firstName: 'X',
          lastName: 'Y',
          password: 'pass',
        } as any),
      ).rejects.toThrow(/already registered/i);
    });

    it('rejects self-registration as ADMIN (privilege escalation guard)', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.register({
          email: 'evil@example.com',
          phone: '+3333333333',
          firstName: 'E',
          lastName: 'V',
          password: 'pass123',
          role: Role.ADMIN,
        } as any),
      ).rejects.toThrow(/admin/i);
      expect(usersRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('throws NotFoundException when user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(
        service.login({ identifier: 'nobody@example.com', password: 'pass' }),
      ).rejects.toThrow(/not found/i);
    });

    it('throws ForbiddenException when account is disabled', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser({ isActive: false }));
      await expect(
        service.login({ identifier: 'test@example.com', password: 'pass' }),
      ).rejects.toThrow(/disabled/i);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser());
      // bcrypt.compare will return false for wrong password
      await expect(
        service.login({ identifier: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(/invalid credentials/i);
    });

    it('returns tokens on successful login', async () => {
      // Use a real bcrypt hash for "password123"
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('password123', 10);
      usersRepo.findOne.mockResolvedValue(mockUser({ passwordHash: hash }));

      const res = await service.login({ identifier: 'test@example.com', password: 'password123' });

      expect(res.accessToken).toBe('mock-token');
      expect(res.refreshToken).toBe('mock-token');
      expect(jwt.signAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException for invalid token', async () => {
      jwt.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.refresh('bad-token')).rejects.toThrow(/invalid refresh token/i);
    });

    it('throws UnauthorizedException when user not found', async () => {
      jwt.verify.mockReturnValue({ sub: 'u-nonexistent', email: 'x@x.com', role: Role.CUSTOMER });
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.refresh('token')).rejects.toThrow();
    });

    it('returns new tokens on valid refresh', async () => {
      jwt.verify.mockReturnValue({ sub: 'u1', email: 'test@example.com', role: Role.CUSTOMER });
      usersRepo.findOne.mockResolvedValue(mockUser());

      const res = await service.refresh('valid-refresh-token');
      expect(res.accessToken).toBe('mock-token');
      expect(jwt.signAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('me', () => {
    it('throws NotFoundException when user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.me('nonexistent')).rejects.toThrow(/not found/i);
    });

    it('returns the user', async () => {
      const u = mockUser();
      usersRepo.findOne.mockResolvedValue(u);
      const res = await service.me('u1');
      expect(res.id).toBe('u1');
      expect(res.email).toBe('test@example.com');
    });
  });
});
