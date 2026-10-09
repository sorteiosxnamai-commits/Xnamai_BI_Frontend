import { z } from "zod";

/** Validação de runtime do contrato /api/v1/erp. Campos extras são tolerados. */
const obj = <T extends z.ZodRawShape>(shape: T) => z.looseObject(shape);
const nstr = z.string().nullable().optional();
const money = z.string().nullable().optional();

export const pageOf = <T extends z.ZodType>(item: T) =>
  obj({
    items: z.array(item),
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
    sort: z.string(),
    order: z.enum(["asc", "desc"]),
    appliedFilters: z.record(z.string(), z.unknown()),
  });

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  sort: string;
  order: "asc" | "desc";
  appliedFilters: Record<string, unknown>;
};

export const meSchema = obj({
  username: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  bootstrap: z.boolean(),
  authMethod: z.string().optional(),
  mustChangePassword: z.boolean().optional(),
  connectionId: z.string(),
  contractVersion: z.string(),
});
export type Me = z.infer<typeof meSchema>;

export const capabilitySchema = obj({
  key: z.string(),
  label: z.string(),
  area: z.string(),
  situation: z.string(),
  supportedByAdaptor: z.boolean(),
  documentedByProvider: z.boolean(),
  accountAccess: z.enum(["unknown", "allowed", "denied"]),
  implementedInErp: z.boolean(),
  enabled: z.boolean(),
  lastValidatedAt: nstr,
  reason: nstr,
  source: nstr,
});
export type Capability = z.infer<typeof capabilitySchema>;
export const capabilitiesSchema = obj({
  connectionId: z.string(),
  items: z.array(capabilitySchema),
});

export const overviewSchema = obj({
  connectionId: z.string(),
  generatedAt: z.string(),
  source: z.string(),
  dataThrough: nstr,
  enabled: z.boolean(),
  resources: z.array(
    obj({
      resource: z.string(),
      label: z.string(),
      status: z.string(),
      records: z.number().nullable(),
      dataThrough: nstr,
      lastSuccessAt: nstr,
      unresolved: z.number().nullable().optional(),
      error: nstr,
    }),
  ),
  operations: z.record(z.string(), z.number()),
  openConflicts: z.number(),
  pendingReferences: z.array(
    obj({ resource: z.string(), field: z.string(), target: z.string(), pending: z.number() }),
  ),
});
export type Overview = z.infer<typeof overviewSchema>;

const metaShape = {
  version: z.number(),
  sourceUpdatedAt: nstr,
  sourceDeleted: z.boolean(),
  capturedAt: nstr,
};

export const customerSchema = obj({
  id: z.string(),
  name: z.string(),
  tradeName: nstr,
  personType: nstr,
  document: nstr,
  city: nstr,
  state: nstr,
  email: nstr,
  phone: nstr,
  segmentId: nstr,
  sellerId: nstr,
  blocked: z.boolean().nullable().optional(),
  active: z.boolean().nullable().optional(),
  piiRestricted: z.boolean(),
  ...metaShape,
});
export type Customer = z.infer<typeof customerSchema>;

export const customerDetailSchema = customerSchema.extend({
  stateRegistration: nstr,
  suframa: nstr,
  street: nstr,
  number: nstr,
  complement: nstr,
  district: nstr,
  zipCode: nstr,
  mobile: nstr,
  blockReason: nstr,
  creditLimit: money,
  notes: nstr,
  extras: z.unknown().optional(),
  sourceCreatedAt: nstr,
  contacts: z.array(
    obj({ id: nstr, name: nstr, role: nstr, email: nstr, phone: nstr, mobile: nstr }),
  ),
  addresses: z.array(
    obj({
      id: nstr, kind: nstr, street: nstr, number: nstr, complement: nstr,
      district: nstr, zipCode: nstr, city: nstr, state: nstr,
    }),
  ),
});
export type CustomerDetail = z.infer<typeof customerDetailSchema>;

export const productSchema = obj({
  id: z.string(),
  code: nstr,
  name: z.string(),
  unit: nstr,
  categoryId: nstr,
  kind: z.string(),
  sellable: z.boolean(),
  listPrice: money,
  minimumPrice: money,
  externalStock: money,
  active: z.boolean().nullable().optional(),
  ...metaShape,
});
export type Product = z.infer<typeof productSchema>;

export const productDetailSchema = productSchema.extend({
  commissionPercent: money,
  ipiPercent: money,
  ncm: nstr,
  multiple: money,
  grossWeight: money,
  width: money,
  height: money,
  length: money,
  imageHashes: z.array(z.string()).nullable().optional(),
  notes: nstr,
  cost: z.null().optional(),
  variants: z.array(
    obj({ id: nstr, code: nstr, name: nstr, externalStock: money, price: money }),
  ),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

export const productPricesSchema = obj({
  items: z.array(
    obj({ id: z.string(), productId: z.string(), priceTableId: z.string(), price: money, priceTableName: nstr }),
  ),
});

export const orderStatusesSchema = obj({
  commercial: nstr,
  billing: nstr,
  fulfillment: nstr,
  payment: nstr,
});

/** Estado de uma fonte local/externa: `unavailable` = sem fonte; `unknown` = fonte sem dado. */
export const stateRefSchema = obj({
  state: z.string(),
  label: nstr,
  reason: nstr,
  source: nstr,
  quoteId: z.number().nullable().optional(),
  draftId: z.number().nullable().optional(),
  price: money,
  deadline: nstr,
});
export type StateRef = z.infer<typeof stateRefSchema>;

export const operationalSchema = obj({
  customerName: nstr,
  responsible: obj({ sellerId: nstr, name: nstr }),
  state: obj({ code: z.string(), label: z.string() }),
  itemsPreview: z.array(obj({ name: nstr, code: nstr, quantity: nstr })),
  totals: obj({ gross: money, discount: money, freight: money, net: money }),
  pendencies: z.array(obj({ code: z.string(), label: z.string() })),
  lastExternalUpdateAt: nstr,
  lastHumanAction: obj({ at: nstr, operator: nstr, action: nstr }).nullable().optional(),
  shipping: stateRefSchema,
  invoice: stateRefSchema,
  payment: stateRefSchema,
  pix: stateRefSchema,
  finance: stateRefSchema.optional(),
});
export type Operational = z.infer<typeof operationalSchema>;

const summarySection = obj({
  available: z.boolean(),
  reason: nstr,
  counts: z.record(z.string(), z.number()).optional(),
});

export const operationalSummarySchema = obj({
  filters: z.record(z.string(), z.unknown()),
  coverage: obj({ complete: z.boolean(), resources: z.record(z.string(), z.string()), note: nstr }),
  orders: obj({ count: z.number(), byKind: z.record(z.string(), z.number()) }),
  values: obj({ net: money, gross: money, note: nstr }),
  variation: obj({ available: z.boolean(), reason: nstr, percent: nstr, previousNet: money }),
  payment: obj({
    byStatus: z.record(z.string(), z.number()),
    pix: obj({ available: z.boolean(), reason: nstr }),
  }),
  pendencies: obj({ itemsIncomplete: z.number(), customerMissing: z.number(), any: z.number() }),
  shipping: summarySection.optional(),
  invoice: summarySection.optional(),
  filtersAvailable: z.array(z.string()).optional(),
});
export type OperationalSummary = z.infer<typeof operationalSummarySchema>;

export const shippingOptionSchema = obj({
  id: z.number(),
  carrier: z.string(),
  service: z.string(),
  price: money,
  deadlineMinDays: z.number().nullable().optional(),
  deadlineMaxDays: z.number().nullable().optional(),
  validUntil: nstr,
  expired: z.boolean(),
  tracking: z.boolean().nullable().optional(),
  pickupMode: nstr,
  notes: nstr,
  source: z.string(),
  createdBy: z.string(),
  createdAt: nstr,
});
export type ShippingOption = z.infer<typeof shippingOptionSchema>;

export const shippingQuoteSchema = obj({
  id: z.number(),
  orderId: z.string(),
  status: z.string(),
  stale: z.boolean(),
  staleReason: nstr,
  source: z.string(),
  version: z.number(),
  orderVersion: z.number(),
  originZip: nstr,
  destination: obj({ zip: nstr, city: nstr, state: nstr }),
  declaredValue: money,
  volumes: z.array(
    obj({ position: z.number(), weightKg: z.string(), lengthCm: z.string(), widthCm: z.string(), heightCm: z.string() }),
  ),
  totals: obj({ volumes: z.number(), weightKg: z.string(), cubageM3: z.string(), items: z.number() }),
  items: z.array(obj({ position: z.number(), productId: nstr, code: nstr, name: nstr, quantity: nstr })),
  options: z.array(shippingOptionSchema),
  selectedOptionId: z.number().nullable().optional(),
  selectedAt: nstr,
  selectedBy: nstr,
  selectionReason: nstr,
  notes: nstr,
  createdBy: z.string(),
  createdAt: nstr,
  statement: z.string(),
});
export type ShippingQuote = z.infer<typeof shippingQuoteSchema>;

export const shippingListSchema = obj({
  orderId: z.string(),
  provider: obj({ available: z.boolean(), reason: nstr }),
  items: z.array(shippingQuoteSchema),
});

export const invoiceChangeSchema = obj({
  sourceKey: z.string(),
  kind: z.string(),
  name: nstr,
  before: z.record(z.string(), z.unknown()).nullable().optional(),
  after: z.record(z.string(), z.unknown()).nullable().optional(),
  valueDifference: money,
  reason: nstr,
});

export const invoiceDraftSchema = obj({
  id: z.number(),
  orderId: z.string(),
  status: z.string(),
  version: z.number(),
  stale: z.boolean(),
  percent: z.string(),
  orderTotal: money,
  target: obj({ percent: z.string(), value: money }),
  effective: obj({ value: money, percentOfOrder: nstr, achievedOfTarget: nstr }),
  difference: obj({ value: money, direction: z.string() }),
  counts: obj({ included: z.number(), total: z.number() }),
  items: z.array(
    obj({
      sourceKey: z.string(),
      position: z.number(),
      productId: nstr,
      code: nstr,
      name: nstr,
      sourceQuantity: z.string(),
      unitValue: money,
      sourceLineTotal: money,
      quantity: z.string(),
      lineValue: money,
      allocatedElsewhere: z.string(),
      available: z.string(),
      included: z.boolean(),
      status: z.string(),
    }),
  ),
  review: obj({ required: z.boolean(), changes: z.array(invoiceChangeSchema), note: nstr }),
  notes: nstr,
  issuance: obj({ available: z.boolean(), reason: nstr }),
  statement: z.string(),
  organizeNote: z.string(),
  createdBy: z.string(),
  createdAt: nstr,
});
export type InvoiceDraft = z.infer<typeof invoiceDraftSchema>;

export const invoiceListSchema = obj({
  orderId: z.string(),
  issuance: obj({ available: z.boolean(), reason: nstr }),
  items: z.array(invoiceDraftSchema),
});

const unavailable = obj({ available: z.boolean(), reason: nstr });
const variation = obj({ available: z.boolean(), reason: nstr, percent: nstr, previous: money });

export const financeSummarySchema = obj({
  period: obj({ from: nstr, to: nstr }),
  sales: obj({ orders: z.number(), net: money, variation }),
  cash: obj({ received: money, reversed: money, net: money, variation }),
  receivable: obj({ open: money, overdue: money }),
  refunds: obj({
    byStatus: z.record(z.string(), obj({ count: z.number(), amount: money })),
    returned: money,
  }),
  pix: unavailable,
  formulas: z.record(z.string(), z.string()),
});
export type FinanceSummary = z.infer<typeof financeSummarySchema>;

export const orderFinanceSchema = obj({
  orderId: z.string(),
  orderTotal: money,
  state: z.string(),
  overdue: z.boolean(),
  obligation: money,
  paid: money,
  open: money,
  titles: z.array(
    obj({
      id: z.number(),
      status: z.string(),
      total: money,
      origin: z.string(),
      installments: z.array(
        obj({
          id: z.number(),
          number: z.number(),
          dueDate: z.string(),
          amount: money,
          settledAmount: money,
          status: z.string(),
          overdue: z.boolean(),
        }),
      ),
    }),
  ),
  payments: z.array(
    obj({
      settlementId: z.number(),
      titleId: z.number(),
      installmentId: z.number(),
      amount: money,
      settledAt: nstr,
      operator: z.string(),
      reference: nstr,
      reversed: z.boolean(),
      refundable: money,
      refundCommitted: money,
    }),
  ),
  externalTitles: z.array(obj({ id: z.string(), amount: money, status: nstr, dueDate: nstr })),
  externalNote: nstr,
  pix: unavailable,
});
export type OrderFinance = z.infer<typeof orderFinanceSchema>;

export const refundSchema = obj({
  id: z.number(),
  orderId: z.string(),
  settlementId: z.number(),
  amount: money,
  reason: z.string(),
  status: z.string(),
  version: z.number(),
  requestedBy: z.string(),
  requestedAt: nstr,
  decidedBy: nstr,
  decidedAt: nstr,
  decisionNote: nstr,
  externalReference: nstr,
  externalConfirmedBy: nstr,
  externalConfirmedAt: nstr,
  reversalSettlementId: z.number().nullable().optional(),
  statement: z.string(),
  events: z
    .array(obj({ at: nstr, operator: z.string(), action: z.string(), reason: nstr }))
    .optional(),
});
export type Refund = z.infer<typeof refundSchema>;

export const orderHistorySchema = obj({
  items: z.array(
    obj({
      at: nstr,
      kind: z.string(),
      operator: z.string(),
      action: z.string(),
      result: nstr,
      reason: nstr,
    }),
  ),
});

export const orderSchema = obj({
  id: z.string(),
  number: nstr,
  kind: z.string(),
  customerId: nstr,
  customerName: nstr,
  sellerId: nstr,
  issuedAt: nstr,
  issueDate: nstr,
  netTotal: money,
  grossTotal: money,
  discountTotal: money,
  itemCount: z.number().nullable().optional(),
  itemsComplete: z.boolean(),
  statuses: orderStatusesSchema,
  operational: operationalSchema.optional(),
  ...metaShape,
});
export type Order = z.infer<typeof orderSchema>;

export const orderDetailSchema = orderSchema.extend({
  orderTypeId: nstr,
  paymentConditionId: nstr,
  priceTableId: nstr,
  carrierId: nstr,
  commercialPolicyId: nstr,
  expectedDeliveryDate: nstr,
  freightTotal: money,
  notes: nstr,
  incomplete: z.boolean(),
  incompleteReason: nstr,
  items: z.array(
    obj({
      id: nstr,
      position: z.number(),
      productId: nstr,
      code: nstr,
      name: nstr,
      quantity: z.string(),
      listUnitPrice: money,
      unitPrice: money,
      discount: money,
      total: money,
      excluded: z.boolean(),
    }),
  ),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

export const catalogEntrySchema = obj({
  id: z.string(),
  localId: z.number(),
  name: z.string(),
  active: z.boolean().nullable().optional(),
  ...metaShape,
});
export type CatalogEntry = z.infer<typeof catalogEntrySchema> & Record<string, unknown>;

export const productPriceRowSchema = obj({
  id: z.string(),
  productId: z.string(),
  priceTableId: z.string(),
  price: money,
  ...metaShape,
});

export const operationSchema = obj({
  operationId: z.string(),
  kind: z.string(),
  status: z.enum([
    "queued",
    "processing",
    "waiting_rate_limit",
    "succeeded",
    "failed",
    "unknown",
    "conflict",
  ]),
  targetResource: z.string(),
  targetId: nstr,
  externalId: nstr,
  operator: z.string(),
  attempts: z.number(),
  errorCode: nstr,
  error: nstr,
  nextAttemptAt: nstr,
  completedAt: nstr,
  mirrorConfirmedAt: nstr,
  createdAt: nstr,
  statusUrl: z.string(),
  synchronized: z.boolean(),
  replayed: z.boolean().optional(),
});
export type Operation = z.infer<typeof operationSchema>;
export type OperationStatus = Operation["status"];

export const operationDetailSchema = operationSchema.extend({
  idempotencyKey: z.string().optional(),
  reconcileEvidence: z.unknown().optional(),
  canReconcile: z.boolean(),
  canRetry: z.boolean(),
  intent: z.unknown().optional(),
});
export type OperationDetail = z.infer<typeof operationDetailSchema>;

export const jobSchema = obj({
  jobId: z.number(),
  kind: z.string(),
  resource: nstr,
  mode: z.string(),
  status: z.string(),
  attempts: z.number(),
  error: nstr,
  statusUrl: z.string(),
  created: z.boolean().optional(),
});

export const integrationStatusSchema = obj({
  connectionId: z.string(),
  adaptorConfigured: z.boolean(),
  writeKeyConfigured: z.boolean(),
  webhookConfigured: z.boolean(),
  resources: z.array(
    obj({
      resource: z.string(),
      label: z.string(),
      upstream: z.string(),
      localRecords: z.number().nullable(),
      unmappedFields: z.number(),
      status: z.string(),
      cursor: nstr,
      transportCursor: nstr,
      dataThrough: nstr,
      lastSuccessAt: nstr,
      lastAttemptAt: nstr,
      unresolved: z.number().nullable().optional(),
      retryAfter: nstr,
      error: nstr,
    }),
  ),
  jobs: z.record(z.string(), z.number()),
  pendingReferences: z.array(
    obj({ resource: z.string(), field: z.string(), target: z.string(), pending: z.number() }),
  ),
});
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;

export const runSchema = obj({
  id: z.number(),
  resource: z.string(),
  mode: z.string(),
  status: z.string(),
  startedAt: nstr,
  finishedAt: nstr,
  pages: z.number(),
  received: z.number(),
  persisted: z.number(),
  unchanged: z.number(),
  quarantined: z.number(),
  error: nstr,
});

export const conflictSchema = obj({
  id: z.number(),
  operationId: nstr,
  entityType: z.string(),
  entityId: nstr,
  fields: z.array(z.string()),
  base: z.record(z.string(), z.unknown()).nullable().optional(),
  local: z.record(z.string(), z.unknown()).nullable().optional(),
  external: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.string(),
  resolution: nstr,
  createdAt: nstr,
});
export type Conflict = z.infer<typeof conflictSchema>;

export const quarantineSchema = obj({
  id: z.number(),
  resource: z.string(),
  externalKey: z.string(),
  reason: z.string(),
  attempts: z.number(),
  createdAt: nstr,
});

export const fieldSchema = obj({
  resource: z.string(),
  sourceKey: z.string(),
  mapped: z.boolean(),
  seenCount: z.number(),
  sampleType: nstr,
  lastSeenAt: nstr,
});

export const availabilitySchema = obj({
  capability: z.string(),
  enabled: z.boolean(),
  implementedInErp: z.boolean(),
  supportedByAdaptor: z.boolean(),
  reason: nstr,
});
export const externalListSchema = obj({
  items: z.array(z.record(z.string(), z.unknown())),
  availability: availabilitySchema,
  note: z.string().optional(),
});

export const supplierSchema = obj({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  document: nstr,
  email: nstr,
  phone: nstr,
  city: nstr,
  state: nstr,
  active: z.boolean(),
});
export type Supplier = z.infer<typeof supplierSchema>;

export const purchaseItemSchema = obj({
  id: z.number(),
  position: z.number(),
  productId: nstr,
  description: z.string(),
  quantity: z.string(),
  receivedQuantity: z.string(),
  pendingQuantity: z.string(),
  unitCost: z.string(),
});
export const receiptSchema = obj({
  id: z.number(),
  invoiceNumber: nstr,
  receivedBy: z.string(),
  receivedAt: nstr,
  reversedAt: nstr,
  reversedBy: nstr,
  reverseReason: nstr,
  lines: z.array(obj({ itemId: z.number(), quantity: z.string() })),
});
export const purchaseOrderSchema = obj({
  id: z.number(),
  number: z.string(),
  supplierId: z.number(),
  supplierName: nstr,
  status: z.string(),
  expectedDate: nstr,
  total: money,
  version: z.number(),
  createdBy: z.string(),
  approvedBy: nstr,
  cancelReason: nstr,
  items: z.array(purchaseItemSchema).optional(),
  receipts: z.array(receiptSchema).optional(),
});
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;

export const warehouseSchema = obj({ id: z.number(), code: z.string(), name: z.string(), active: z.boolean() });
export const authoritySchema = obj({
  scope: z.string(),
  authority: z.enum(["mercos", "erp"]),
  effective: z.boolean(),
  cutoverAt: nstr,
  reconciledAt: nstr,
  publishEnabled: z.boolean(),
  publishReason: z.string(),
  movementsEnabled: z.boolean(),
  movementsReason: nstr,
});
export type Authority = z.infer<typeof authoritySchema>;
export const balanceSchema = obj({
  warehouseId: z.number(),
  productId: z.string(),
  productName: nstr,
  operational: obj({ onHand: z.string(), reserved: z.string(), available: z.string() }),
  external: obj({ quantity: nstr, source: z.string() }),
});
export const balancesSchema = pageOf(balanceSchema).extend({ authority: authoritySchema });
export const movementSchema = obj({
  id: z.number(),
  warehouseId: z.number(),
  productId: z.string(),
  kind: z.string(),
  quantityDelta: z.string(),
  reservedDelta: z.string(),
  unitCost: nstr,
  referenceType: nstr,
  reason: nstr,
  operator: z.string(),
  occurredAt: nstr,
});
export const reservationSchema = obj({
  id: z.number(),
  warehouseId: z.number(),
  productId: z.string(),
  quantity: z.string(),
  status: z.string(),
  orderId: nstr,
});

export const installmentSchema = obj({
  id: z.number(),
  number: z.number(),
  dueDate: z.string(),
  amount: z.string(),
  settledAmount: z.string(),
  openAmount: z.string(),
  status: z.string(),
  overdue: z.boolean(),
});
export const settlementSchema = obj({
  id: z.number(),
  installmentId: z.number(),
  accountId: z.number(),
  kind: z.string(),
  amount: z.string(),
  settledAt: nstr,
  reversalOfId: z.number().nullable().optional(),
  reference: nstr,
  reason: nstr,
});
export const finTitleSchema = obj({
  id: z.number(),
  kind: z.string(),
  number: nstr,
  description: z.string(),
  supplierId: z.number().nullable().optional(),
  customerId: nstr,
  total: z.string(),
  status: z.string(),
  createdBy: z.string(),
  originType: nstr,
  scope: z.string().optional(),
  installments: z.array(installmentSchema).optional(),
  settlements: z.array(settlementSchema).optional(),
});
export type FinTitle = z.infer<typeof finTitleSchema>;
export const accountSchema = obj({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  kind: z.string(),
  active: z.boolean(),
  openingBalance: z.string(),
  balance: z.string(),
});
export const simpleListSchema = <T extends z.ZodType>(item: T) => obj({ items: z.array(item) });
export const cashFlowSchema = obj({
  from: z.string(),
  to: z.string(),
  days: z.array(obj({ date: z.string(), planned: z.string(), realized: z.string() })),
  totals: obj({ planned: z.string(), realized: z.string() }),
});

export const operatorSchema = obj({
  username: z.string(),
  displayName: nstr,
  roles: z.array(z.string()),
  active: z.boolean(),
  hasPassword: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
  locked: z.boolean().optional(),
  lastLoginAt: nstr,
  activeSessions: z.number().optional(),
});
export const temporaryPasswordSchema = obj({
  username: z.string(),
  temporaryPassword: z.string(),
  mustChangePassword: z.boolean(),
  note: z.string(),
});
export const sessionsSchema = obj({
  items: z.array(
    obj({ id: z.string(), current: z.boolean(), createdAt: nstr, lastUsedAt: nstr, expiresAt: nstr, ip: nstr, userAgent: nstr }),
  ),
});
export const operatorsSchema = obj({ items: z.array(operatorSchema), roles: z.array(z.string()) });
export const auditSchema = obj({
  id: z.number(),
  at: nstr,
  operator: z.string(),
  action: z.string(),
  resource: nstr,
  resourceId: nstr,
  result: nstr,
  reason: nstr,
});

export const idSchema = obj({ id: z.number() });
