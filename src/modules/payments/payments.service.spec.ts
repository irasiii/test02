import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus, PaymentPurpose } from './entities/payment.entity';
import { StripeService } from '../../infra/stripe/stripe.service';
import { OrdersService } from '../orders/orders.service';
import { TripsService } from '../trips/trips.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentsRepo: any;
  let stripe: any;
  let ordersService: any;
  let tripsService: any;

  beforeEach(async () => {
    paymentsRepo = {
      create: jest.fn((x) => ({ ...x })),
      save: jest.fn(async (x) => ({ ...x, id: 'pay-1' })),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    stripe = { createPaymentIntent: jest.fn(), refund: jest.fn(), buildWebhookEvent: jest.fn() };
    ordersService = {};
    tripsService = {};

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: StripeService, useValue: stripe },
        { provide: OrdersService, useValue: ordersService },
        { provide: TripsService, useValue: tripsService },
      ],
    }).compile();
    service = moduleRef.get(PaymentsService);
  });

  it('createIntent rejects non-positive amounts', async () => {
    await expect(service.createIntent('u1', PaymentPurpose.TRIP, 't1', 0)).rejects.toThrow(
      /Amount must be > 0/,
    );
  });

  it('createIntent records a PENDING payment and returns the client secret', async () => {
    stripe.createPaymentIntent.mockResolvedValue({
      id: 'pi_1',
      clientSecret: 'sec',
      status: 'requires_payment_method',
    });

    const res = await service.createIntent('u1', PaymentPurpose.ORDER, 'o1', 25.5);

    expect(paymentsRepo.create).toHaveBeenCalled();
    expect(paymentsRepo.save).toHaveBeenCalled();
    expect(res.clientSecret).toBe('sec');
  });

  it('refund without amount marks REFUNDED, with amount PARTIALLY_REFUNDED', async () => {
    paymentsRepo.findOne.mockResolvedValue({ id: 'pay-1', providerIntentId: 'pi_1', status: PaymentStatus.SUCCEEDED });
    stripe.refund.mockResolvedValue({ id: 're_1', status: 'succeeded' });
    await service.refund('pay-1');
    expect(paymentsRepo.save.mock.calls.at(-1)![0].status).toBe(PaymentStatus.REFUNDED);

    paymentsRepo.findOne.mockResolvedValue({ id: 'pay-2', providerIntentId: 'pi_2', status: PaymentStatus.SUCCEEDED });
    await service.refund('pay-2', 5);
    expect(paymentsRepo.save.mock.calls.at(-1)![0].status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
  });

  it('refund throws when there is no provider intent', async () => {
    paymentsRepo.findOne.mockResolvedValue({ id: 'pay-3', providerIntentId: null });
    await expect(service.refund('pay-3')).rejects.toThrow(/No provider intent/);
  });

  it('markSucceeded flips the status to SUCCEEDED', async () => {
    paymentsRepo.findOne.mockResolvedValue({ id: 'pay-1', providerIntentId: 'pi_1' });
    const p = await service.markSucceeded('pi_1');
    expect(p.status).toBe(PaymentStatus.SUCCEEDED);
  });
});

describe('StripeService (mock mode)', () => {
  it('returns a fake intent when no real key is configured', async () => {
    const { StripeService } = await import('../../infra/stripe/stripe.service');
    const svc = new StripeService({ get: () => '' } as any);
    const intent = await svc.createPaymentIntent(20, 'usd', {});
    expect(intent.id).toMatch(/^pi_mock_/);
    expect(intent.clientSecret).toBe(`${intent.id}_secret`);
  });
});
