/**
 * The OrderItem entity is defined alongside Order in ./order.entity.ts
 * (TypeORM registration and all imports across the codebase resolve there).
 * This file re-exports it so the conventional per-entity path also works.
 */
export { OrderItem } from './order.entity';
