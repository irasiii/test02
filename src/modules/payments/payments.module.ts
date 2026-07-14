import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentsService } from './payments.service';
import { PaymentsController, PaymentsWebhookController } from './payments.controller';
import { Payment } from './entities/payment.entity';
import { OrdersModule } from '../orders/orders.module';
import { TripsModule } from '../trips/trips.module';
import { StripeModule } from '../../infra/stripe/stripe.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    OrdersModule,
    TripsModule,
    StripeModule,
    AuthModule,
  ],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
