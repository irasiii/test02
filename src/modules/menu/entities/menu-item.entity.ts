import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../app/common/entities/base.entity';
import { MenuCategory } from './menu-category.entity';

@Entity('menu_items')
export class MenuItem extends BaseEntity {
  @Index()
  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @ManyToOne(() => MenuCategory, (category) => category.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: MenuCategory;

  @Index()
  @Column({ name: 'category_id' })
  categoryId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: number;

  @Column({ nullable: true })
  imageUrl: string | null;

  @Column({ type: 'boolean', default: true })
  isAvailable: boolean;

  @Column({ type: 'boolean', default: false })
  isVegetarian: boolean;

  @Column({ type: 'boolean', default: false })
  isVegan: boolean;

  @Column({ type: 'boolean', default: false })
  isGlutenFree: boolean;

  @Column({ type: 'int', default: 0 })
  prepTimeMin: number;

  @Column({ type: 'int', default: 0, name: 'calorie_count' })
  calorieCount: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  discountPercent: number;
}
