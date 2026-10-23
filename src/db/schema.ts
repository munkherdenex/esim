import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const orderStatus = pgEnum('order_status', [
  'PENDING_PAYMENT',
  'PAID',
  'PROVISIONING',
  'DELIVERED',
  'FAILED',
  'EXPIRED',
]);

export const packages = pgTable(
  'packages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    providerPackageCode: text('provider_package_code').notNull(),
    providerName: text('provider_name').notNull(),
    countryCode: text('country_code').notNull(),
    countryNameMn: text('country_name_mn'),
    dataGb: numeric('data_gb', { precision: 12, scale: 3, mode: 'number' }).notNull(),
    validityDays: integer('validity_days').notNull(),
    costUsd: numeric('cost_usd', { precision: 12, scale: 4, mode: 'number' }).notNull(),
    priceMnt: integer('price_mnt').notNull(),
    priceOverridden: boolean('price_overridden').notNull().default(false),
    supportsChinaSocialApps: boolean('supports_china_social_apps')
      .notNull()
      .default(false),
    isActive: boolean('is_active').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('packages_provider_code_uq').on(table.providerPackageCode),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publicCode: text('public_code').notNull(),
    accessTokenHash: text('access_token_hash').notNull(),
    customerPhone: text('customer_phone').notNull(),
    customerEmail: text('customer_email'),
    packageId: uuid('package_id')
      .notNull()
      .references(() => packages.id),
    priceMnt: integer('price_mnt').notNull(),
    status: orderStatus('status').notNull().default('PENDING_PAYMENT'),
    qpayInvoiceId: text('qpay_invoice_id'),
    qpayPaymentId: text('qpay_payment_id'),
    providerOrderNo: text('provider_order_no'),
    providerTransactionId: text('provider_transaction_id').notNull(),
    iccid: text('iccid'),
    lpaActivationCode: text('lpa_activation_code'),
    qrUrl: text('qr_url'),
    errorMessage: text('error_message'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('orders_public_code_uq').on(table.publicCode),
    uniqueIndex('orders_provider_transaction_id_uq').on(
      table.providerTransactionId,
    ),
    uniqueIndex('orders_qpay_invoice_id_uq').on(table.qpayInvoiceId),
    uniqueIndex('orders_qpay_payment_id_uq').on(table.qpayPaymentId),
    index('orders_status_created_at_idx').on(table.status, table.createdAt),
  ],
);

export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    message: text('message'),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('order_events_order_created_at_idx').on(
      table.orderId,
      table.createdAt,
    ),
  ],
);

export const topups = pgTable(
  'topups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publicCode: text('public_code').notNull(),
    accessTokenHash: text('access_token_hash').notNull(),
    iccid: text('iccid').notNull(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => packages.id),
    priceMnt: integer('price_mnt').notNull(),
    status: orderStatus('status').notNull().default('PENDING_PAYMENT'),
    qpayInvoiceId: text('qpay_invoice_id'),
    qpayPaymentId: text('qpay_payment_id'),
    providerTransactionId: text('provider_transaction_id').notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('topups_public_code_uq').on(table.publicCode),
    uniqueIndex('topups_provider_transaction_id_uq').on(
      table.providerTransactionId,
    ),
    uniqueIndex('topups_qpay_invoice_id_uq').on(table.qpayInvoiceId),
    uniqueIndex('topups_qpay_payment_id_uq').on(table.qpayPaymentId),
    index('topups_status_created_at_idx').on(table.status, table.createdAt),
  ],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
