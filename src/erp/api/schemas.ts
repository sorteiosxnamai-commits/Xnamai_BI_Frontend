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
