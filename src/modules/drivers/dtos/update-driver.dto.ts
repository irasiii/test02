import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { DriverStatus, DriverType } from '../entities/driver.entity';

export class UpdateDriverDto {
  @ApiPropertyOptional({ enum: DriverStatus })
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;

  @ApiPropertyOptional({ enum: DriverType })
  @IsOptional()
  @IsEnum(DriverType)
  type?: DriverType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;
}
