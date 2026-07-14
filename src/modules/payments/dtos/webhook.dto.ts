import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class StripeWebhookDto {
  @ApiPropertyOptional({ description: 'Stripe event type, e.g. "payment_intent.succeeded"' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Raw body buffer (handled by controller)' })
  @IsOptional()
  raw?: Buffer;

  @IsOptional()
  @IsObject()
  data?: any;
}
