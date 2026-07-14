import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../app/common/entities/base.entity';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';
import { MenuItem } from './menu-item.entity';

@Entity('menu_categories')
export class MenuCategory extends BaseEntity {
  @Index()
  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.menuCategories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant;

  @Column()
  name: string;

  @Column({ default: 0 })
  sortOrder: number;

  @OneToMany(() => MenuItem, (item) => item.category)
  items: MenuItem[];
}
