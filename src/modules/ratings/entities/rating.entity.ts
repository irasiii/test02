import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../app/common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum RatingTarget {
  DRIVER = 'DRIVER',
  CUSTOMER = 'CUSTOMER',
  RESTAURANT = 'RESTAURANT',
  ITEM = 'ITEM',
}

@Entity('ratings')
export class Rating extends BaseEntity {
  @ManyToOne(() => User, (user) => user.givenRatings)
  reviewer: User;

  @Index()
  @Column({ name: 'reviewer_id' })
  reviewerId: string;

  @Index()
  @Column({ name: 'target_id' })
  targetId: string;

  @Column({ type: 'enum', enum: RatingTarget })
  target: RatingTarget;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'reference_id' })
  referenceId: string | null; // Trip.id or Order.id

  @Column({ type: 'int' })
  stars: number; // 1..5

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'jsonb', default: [], name: 'tags' })
  tags: string[]; // e.g. ['Quick', 'Polite', 'Clean car']
}
