import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { VehicleType } from '../entities/vehicle.entity';

export class CreateVehicleDto {
  @ApiProperty({ enum: VehicleType, default: VehicleType.SEDAN })
  @IsEnum(VehicleType)
  type: VehicleType;

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  @MinLength(2)
  make: string;

  @ApiProperty({ example: 'Camry' })
  @IsString()
  model: string;

  @ApiProperty({ example: '2021' })
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  year: string;

  @ApiProperty({ example: 'ABC-1234' })
  @IsString()
  plateNumber: string;

  @ApiProperty({ required: false, example: '#ffffff' })
  @IsString()
  color?: string;

  @ApiProperty({ required: false, default: 4 })
  capacity?: number;
}
