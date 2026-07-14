import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../app/common/guards/jwt-auth.guard';
import { Roles, Role } from '../../app/common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../app/common/decorators/current-user.decorator';
import { PaymentPurpose } from './entities/payment.entity';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('intent')
  @ApiOperation({ summary: 'Create a Stripe PaymentIntent for an order or trip' })
  createIntent(
    @CurrentUser() user: AuthUser,
    @Body() body: { purpose: PaymentPurpose; referenceId: string; amount: number; description?: string },
  ) {
    return this.payments.createIntent(
      user.id,
      body.purpose,
      body.referenceId,
      body.amount,
      body.description,
    );
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: list all payments' })
  listAll() {
    return this.payments.listAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment status' })
  get(@Param('id') id: string) {
    return this.payments.getOne(id);
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Refund a payment' })
  refund(@Param('id') id: string, @Body() body: { amount?: number }) {
    return this.payments.refund(id, body.amount);
  }

  // Stripe webhook — no JWT auth, verified via signature
  // We don't use @UseGuards here, so we need the controller to expose raw body.
  // The express body-parser must be configured with `verify` in main.ts
}

// Separate controller for webhooks (no auth, raw body needed)
@ApiTags('Payments')
@Controller('payments/webhook')
export class PaymentsWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  webhook(@Req() req: Request, @Body() _raw: Buffer) {
    const signature = req.headers['stripe-signature'] as string;
    return this.payments.handleWebhookEvent(_raw, signature);
  }
}
