import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { TripType } from '../entities/trip.entity';

export class RequestTripDto {
  @ApiProperty({ example: 24.7136 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat: number;

  @ApiProperty({ example: 46.6753 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng: number;

  @ApiProperty({ example: 'King Fahd Rd, Riyadh' })
  @IsString()
  pickupAddress: string;

  @ApiProperty()
  @IsNumber()
  destinationLat: number;

  @ApiProperty()
  @IsNumber()
  destinationLng: number;

  @ApiProperty()
  @IsString()
  destinationAddress: string;

  @ApiPropertyOptional({ enum: TripType, default: TripType.RIDE })
  @IsOptional()
  @IsEnum(TripType)
  type?: TripType;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8)
  passengerCount?: number;
}
