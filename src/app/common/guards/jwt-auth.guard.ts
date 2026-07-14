import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY, Role } from '../decorators/roles.decorator';
import { AuthUser } from '../decorators/current-user.decorator';
import { User } from '../../../modules/users/entities/user.entity';

/**
 * Self-contained JWT + roles guard. Verifies the bearer token, attaches the user
 * to `req.user`, and enforces @Roles(...) restrictions. Avoids extra deps like
 * passport-jwt for the boilerplate. Share the same class both as AuthGuard and
 * RolesGuard — they are often used together.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization || '';
    const [scheme, token] = auth.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: { sub: string; email: string; role: Role };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('jwt.secret', 'super-secret-change-me'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException('User inactive');

    request.user = { id: user.id, email: user.email, role: user.role } as AuthUser;

    // Enforce roles if the route declared them.
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required && required.length > 0 && !required.includes(user.role)) {
      throw new UnauthorizedException('Insufficient role');
    }
    return true;
  }
}
