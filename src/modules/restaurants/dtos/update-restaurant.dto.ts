import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { CreateRestaurantDto } from './create-restaurant.dto';
import { RestaurantStatus } from '../entities/restaurant.entity';

export class UpdateRestaurantDto extends PartialType(CreateRestaurantDto) {
  @IsOptional()
  @IsEnum(RestaurantStatus)
  status?: RestaurantStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
