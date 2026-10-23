export interface QPayInvoiceLink {
  name: string;
  description?: string;
  logo?: string;
  link: string;
}

export interface CreateInvoiceInput {
  senderInvoiceNo: string;
  description: string;
  amountMnt: number;
  callbackUrl: string;
  customerPhone: string;
  orderCode: string;
}

export interface CreatedInvoice {
  invoiceId: string;
  qrText: string;
  qrImage: string;
  shortUrl?: string;
  urls: QPayInvoiceLink[];
}

export interface PaymentVerification {
  paid: boolean;
  paymentId?: string;
  transactionCount: number;
}

export interface PaymentProvider {
  createInvoice(input: CreateInvoiceInput): Promise<CreatedInvoice>;
  checkPayment(invoiceId: string): Promise<PaymentVerification>;
}
