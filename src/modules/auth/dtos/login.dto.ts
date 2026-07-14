import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  identifier: string; // email or phone

  @ApiProperty({ example: 'P@ssw0rd!' })
  @IsString()
  password: string;
}
