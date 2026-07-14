import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { UpdateUserDto } from './dtos/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async findAll() {
    return this.users.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmailOrPhone(identifier: string) {
    return this.users.findOne({
      where: [{ email: identifier }, { phone: identifier }],
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.users.update(id, dto);
    return this.findOne(id);
  }

  async deactivate(id: string) {
    await this.users.update(id, { isActive: false });
    return { success: true };
  }

  async setFcmToken(id: string, token: string) {
    await this.users.update(id, { fcmToken: token });
    return { success: true };
  }

  async updateWallet(id: string, delta: number) {
    await this.users.increment({ id }, 'walletBalance', delta);
    return this.findOne(id);
  }
}
