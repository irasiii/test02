import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export enum Role {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  RESTAURANT = 'RESTAURANT',
  ADMIN = 'ADMIN',
}

/**
 * Allow only authenticated users with one of these roles to access the route.
 * @example @Roles(Role.ADMIN, Role.DRIVER)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
