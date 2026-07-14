import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Payment, PaymentPurpose, PaymentStatus } from './entities/payment.entity';
import { StripeService } from '../../infra/stripe/stripe.service';
import { OrdersService } from '../orders/orders.service';
import { TripsService } from '../trips/trips.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');

  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    private readonly stripe: StripeService,
    private readonly ordersService: OrdersService,
    private readonly tripsService: TripsService,
  ) {}

  /** Create a Stripe PaymentIntent + record in DB. */
  async createIntent(
    userId: string,
    purpose: PaymentPurpose,
    referenceId: string | null,
    amount: number,
    description?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Amount must be > 0');
    const intent = await this.stripe.createPaymentIntent(amount, 'usd', {
      userId,
      purpose,
      referenceId: referenceId ?? '',
    });
    const rec = this.payments.create({
      userId,
      purpose,
      referenceId,
      providerIntentId: intent.id,
      amount,
      currency: 'usd',
      status: PaymentStatus.PENDING,
      description,
    });
    await this.payments.save(rec);
    return { paymentId: rec.id, intentId: intent.id, clientSecret: intent.clientSecret, amount, currency: 'usd' };
  }

  /** Admin: list all payments with the user relation, newest first. */
  async listAll(limit = 100) {
    return this.payments.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 500),
    });
  }

  async getOne(id: string) {
    const p = await this.payments.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Payment not found');
    return p;
  }

  async findByReference(purpose: PaymentPurpose, referenceId: string) {
    return this.payments.find({ where: { purpose, referenceId } });
  }

  /**
   * Internal: mark payment as succeeded.
   */
  async markSucceeded(providerIntentId: string) {
    const p = await this.payments.findOne({ where: { providerIntentId } });
    if (!p) {
      this.logger.warn(`Unknown intent received: ${providerIntentId}`);
      return null;
    }
    p.status = PaymentStatus.SUCCEEDED;
    await this.payments.save(p);
    return p;
  }

  async markFailed(providerIntentId: string) {
    const p = await this.payments.findOne({ where: { providerIntentId } });
    if (!p) return null;
    p.status = PaymentStatus.FAILED;
    return this.payments.save(p);
  }

  async refund(paymentId: string, amount?: number) {
    const p = await this.getOne(paymentId);
    if (!p.providerIntentId) throw new BadRequestException('No provider intent');
    const refund = await this.stripe.refund(p.providerIntentId, amount);
    p.status = amount ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.REFUNDED;
    await this.payments.save(p);
    return refund;
  }

  /** Internal: handle webhook from Stripe. */
  async handleWebhookEvent(rawBody: Buffer, signature: string) {
    const event = this.stripe.buildWebhookEvent(rawBody, signature);
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as any;
        await this.markSucceeded(intent.id);
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as any;
        await this.markFailed(intent.id);
        break;
      }
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
    return { received: true };
  }
}
