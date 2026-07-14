import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateLocationDto {
  @ApiProperty({ example: 24.7136 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 46.6753 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({ required: false, example: 12 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  speedKmh?: number;

  @ApiProperty({ required: false, example: 90 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;
}
