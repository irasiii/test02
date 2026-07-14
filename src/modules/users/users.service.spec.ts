import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepo: any;

  const mockUser = (over: Record<string, any> = {}) => ({
    id: 'u1',
    email: 'test@example.com',
    phone: '+1234567890',
    firstName: 'John',
    lastName: 'Doe',
    role: 'CUSTOMER',
    isActive: true,
    walletBalance: 0,
    ...over,
  });

  beforeEach(async () => {
    usersRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      increment: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('findAll', () => {
    it('returns all users ordered by creation date', async () => {
      usersRepo.find.mockResolvedValue([mockUser(), mockUser({ id: 'u2' })]);
      const res = await service.findAll();
      expect(res.length).toBe(2);
      expect(usersRepo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { createdAt: 'DESC' } }));
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(/not found/i);
    });

    it('returns the user', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser());
      const res = await service.findOne('u1');
      expect(res.id).toBe('u1');
    });
  });

  describe('findByEmailOrPhone', () => {
    it('finds by email', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser());
      const res = await service.findByEmailOrPhone('test@example.com');
      expect(res).toBeTruthy();
    });

    it('returns null when not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      const res = await service.findByEmailOrPhone('nobody@example.com');
      expect(res).toBeNull();
    });
  });

  describe('update', () => {
    it('updates and returns the user', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser({ firstName: 'Jane' }));
      const res = await service.update('u1', { firstName: 'Jane' } as any);
      expect(usersRepo.update).toHaveBeenCalledWith('u1', { firstName: 'Jane' });
      expect(res.firstName).toBe('Jane');
    });
  });

  describe('deactivate', () => {
    it('sets isActive to false', async () => {
      const res = await service.deactivate('u1');
      expect(usersRepo.update).toHaveBeenCalledWith('u1', { isActive: false });
      expect(res.success).toBe(true);
    });
  });

  describe('setFcmToken', () => {
    it('stores the FCM token', async () => {
      const res = await service.setFcmToken('u1', 'fcm-token-abc');
      expect(usersRepo.update).toHaveBeenCalledWith('u1', { fcmToken: 'fcm-token-abc' });
      expect(res.success).toBe(true);
    });
  });

  describe('updateWallet', () => {
    it('increments wallet balance and returns updated user', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser({ walletBalance: 50 }));
      const res = await service.updateWallet('u1', 25);
      expect(usersRepo.increment).toHaveBeenCalledWith({ id: 'u1' }, 'walletBalance', 25);
      expect(res.walletBalance).toBe(50);
    });
  });
});
