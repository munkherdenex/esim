import { randomUUID } from 'node:crypto';
import type {
  CreateInvoiceInput,
  CreatedInvoice,
  PaymentProvider,
  PaymentVerification,
} from './types';

export class MockPaymentProvider implements PaymentProvider {
  constructor(
    private readonly hasMockPayment: (invoiceId: string) => Promise<boolean>,
  ) {}

  async createInvoice(_input: CreateInvoiceInput): Promise<CreatedInvoice> {
    return {
      invoiceId: `mock-${randomUUID()}`,
      qrText: '',
      qrImage: '',
      shortUrl: undefined,
      urls: [],
    };
  }

  async checkPayment(invoiceId: string): Promise<PaymentVerification> {
    return {
      paid: await this.hasMockPayment(invoiceId),
      transactionCount: 0,
    };
  }
}
