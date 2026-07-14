import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger('Stripe');
  private client: Stripe | null = null;
  /** When no real key is configured we simulate intents/refunds locally so the
   *  payments flow is exercisable without a Stripe account. Set STRIPE_SECRET_KEY
   *  to a real test/live key to use the live Stripe API. */
  private readonly isMock: boolean;

  constructor(private config: ConfigService) {
    const secretKey = config.get<string>('stripe.secretKey', '');
    this.isMock = !secretKey || secretKey === 'sk_test_xxx';
    if (!this.isMock) {
      this.client = new Stripe(secretKey, { apiVersion: '2024-06-20' as any });
    } else {
      this.logger.warn('Stripe secret not configured — payments run in MOCK mode (no real charges).');
    }
  }

  /**
   * Create a PaymentIntent for the given amount (in major currency units).
   */
  async createPaymentIntent(amount: number, currency = 'usd', metadata: Record<string, string> = {}) {
    if (this.isMock) {
      const id = `pi_mock_${Math.random().toString(36).slice(2, 12)}`;
      return { id, clientSecret: `${id}_secret`, status: 'requires_payment_method' as const };
    }
    const intent = await this.client!.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata,
      automatic_payment_methods: { enabled: true },
    });
    return { id: intent.id, clientSecret: intent.client_secret, status: intent.status };
  }

  async retrieve(id: string) {
    if (this.isMock) return { id, status: 'succeeded' as const };
    return this.client!.paymentIntents.retrieve(id);
  }

  async refund(id: string, amount?: number) {
    if (this.isMock) {
      return { id: `re_mock_${Math.random().toString(36).slice(2, 12)}`, status: 'succeeded' as const, amount: amount ? Math.round(amount * 100) : undefined };
    }
    const params: Stripe.RefundCreateParams = { payment_intent: id };
    if (amount) params.amount = Math.round(amount * 100);
    const refund = await this.client!.refunds.create(params);
    return { id: refund.id, status: refund.status, amount: refund.amount };
  }

  buildWebhookEvent(rawBody: Buffer | string, signature: string) {
    const webhookSecret = this.config.get<string>('stripe.webhookSecret', '');
    if (!webhookSecret) throw new BadRequestException('Stripe webhook secret missing');
    if (!this.client) throw new BadRequestException('Stripe not configured (mock mode)');
    return this.client.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }

  getWebhookSecret() {
    return this.config.get<string>('stripe.webhookSecret', '');
  }
}
