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

  it('createIntent rejects negative amounts', async () => {
    await expect(service.createIntent('u1', PaymentPurpose.TRIP, 't1', -5)).rejects.toThrow(
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

  it('refund throws when payment not found', async () => {
    paymentsRepo.findOne.mockResolvedValue(null);
    await expect(service.refund('nonexistent')).rejects.toThrow(/not found/i);
  });

  it('markSucceeded flips the status to SUCCEEDED', async () => {
    paymentsRepo.findOne.mockResolvedValue({ id: 'pay-1', providerIntentId: 'pi_1' });
    const p = await service.markSucceeded('pi_1');
    expect(p.status).toBe(PaymentStatus.SUCCEEDED);
  });

  it('markSucceeded returns null for unknown intent', async () => {
    paymentsRepo.findOne.mockResolvedValue(null);
    const p = await service.markSucceeded('pi_unknown');
    expect(p).toBeNull();
  });

  it('markFailed sets status to FAILED', async () => {
    paymentsRepo.findOne.mockResolvedValue({ id: 'pay-1', providerIntentId: 'pi_1', status: PaymentStatus.PENDING });
    const p = await service.markFailed('pi_1');
    expect(p.status).toBe(PaymentStatus.FAILED);
  });

  it('markFailed returns null for unknown intent', async () => {
    paymentsRepo.findOne.mockResolvedValue(null);
    const p = await service.markFailed('pi_unknown');
    expect(p).toBeNull();
  });

  it('listAll returns payments with user relation', async () => {
    paymentsRepo.find.mockResolvedValue([{ id: 'pay-1' }, { id: 'pay-2' }]);
    const res = await service.listAll();
    expect(res.length).toBe(2);
    expect(paymentsRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
  });

  it('getOne throws NotFoundException when payment not found', async () => {
    paymentsRepo.findOne.mockResolvedValue(null);
    await expect(service.getOne('nonexistent')).rejects.toThrow(/not found/i);
  });

  it('getOne returns the payment', async () => {
    paymentsRepo.findOne.mockResolvedValue({ id: 'pay-1', amount: 25 });
    const res = await service.getOne('pay-1');
    expect(res.id).toBe('pay-1');
  });

  it('findByReference returns matching payments', async () => {
    paymentsRepo.find.mockResolvedValue([{ id: 'pay-1' }]);
    const res = await service.findByReference(PaymentPurpose.ORDER, 'o1');
    expect(res.length).toBe(1);
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

  it('retrieve returns mock result in mock mode', async () => {
    const { StripeService } = await import('../../infra/stripe/stripe.service');
    const svc = new StripeService({ get: () => '' } as any);
    const res = await svc.retrieve('pi_mock_123');
    expect(res.id).toBe('pi_mock_123');
    expect(res.status).toBe('succeeded');
  });

  it('refund returns mock result in mock mode', async () => {
    const { StripeService } = await import('../../infra/stripe/stripe.service');
    const svc = new StripeService({ get: () => '' } as any);
    const res = await svc.refund('pi_mock_123', 10);
    expect(res.id).toMatch(/^re_mock_/);
    expect(res.status).toBe('succeeded');
  });

  it('buildWebhookEvent throws when webhook secret missing', async () => {
    const { StripeService } = await import('../../infra/stripe/stripe.service');
    const svc = new StripeService({ get: () => '' } as any);
    expect(() => svc.buildWebhookEvent(Buffer.from(''), 'sig')).toThrow(/webhook secret missing/i);
  });

  it('buildWebhookEvent throws when Stripe not configured (mock mode)', async () => {
    const { StripeService } = await import('../../infra/stripe/stripe.service');
    const svc = new StripeService({ get: (key: string) => key === 'stripe.webhookSecret' ? 'whsec_test' : '' } as any);
    expect(() => svc.buildWebhookEvent(Buffer.from(''), 'sig')).toThrow(/mock mode/i);
  });
});
