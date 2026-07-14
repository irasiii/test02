import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { RatingTarget } from '../entities/rating.entity';

export class CreateRatingDto {
  @ApiProperty({ enum: RatingTarget })
  @IsEnum(RatingTarget)
  target: RatingTarget;

  @ApiProperty()
  @IsString()
  targetId: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ type: [String], example: ['Polite', 'Clean car'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(10)
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceId?: string; // trip.id or order.id
}
