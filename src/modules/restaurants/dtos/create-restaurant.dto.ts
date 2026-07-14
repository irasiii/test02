import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class OpeningHourDto {
  @IsString()
  day: string;
  @IsString()
  from: string;
  @IsString()
  to: string;
}

export class CreateRestaurantDto {
  @ApiProperty({ example: 'Burger House' })
  @IsString()
  name: string;

  @ApiProperty({ example: ' burgers@example.com' })
  @IsString()
  email: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional({ example: 'Best burgers in town' })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  coverUrl?: string;

  @ApiProperty({ example: 24.7136 })
  @IsNumber()
  @Min(-90)
  lat: number;

  @ApiProperty({ example: 46.6753 })
  @IsNumber()
  @Min(-180)
  lng: number;

  @ApiProperty({ example: '123 Main St, Riyadh' })
  @IsString()
  address: string;

  @ApiPropertyOptional({ type: [String], example: ['Burgers', 'Fries'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  cuisineTypes?: string[];

  @ApiPropertyOptional({ type: [OpeningHourDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningHourDto)
  openingHours?: OpeningHourDto[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrder?: number;
}
