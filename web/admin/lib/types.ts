// Response shapes returned by the admin API (backend/src/admin).

export interface UserListRow {
  id: string;
  fullName: string;
  phone: string;
  googleEmail: string | null;
  googleLinkedAt: string | null;
  role: 'ADMIN' | 'MERCHANT' | 'SUB_MERCHANT';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
  creditsBalance: string | null;
  packageCode: string | null;
  merchant: {
    id: string;
    businessName: string;
    status: string;
    relation: 'OWNER' | 'SUB_MERCHANT';
    branchLabel?: string | null;
  } | null;
  lastLoginAt: string | null;
  createdAt: string;
  pinSetAt: string | null;
  sessionCount: number;
}

export interface UserListResponse {
  users: UserListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UserDetail {
  profile: {
    id: string;
    fullName: string;
    phone: string;
    phoneVerifiedAt: string | null;
    role: 'ADMIN' | 'MERCHANT' | 'SUB_MERCHANT';
    status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
    preferredLanguage: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    lastLoginAt: string | null;
    googleEmail: string | null;
    googleLinkedAt: string | null;
    phonePairedAt: string | null;
    pin: {
      set: boolean;
      setAt: string | null;
      failedAttempts: number;
      lockedUntil: string | null;
      biometricEnabled: boolean;
    };
  };
  merchant:
    | {
        id: string;
        businessName: string;
        businessType: string | null;
        tin: string | null;
        address: string | null;
        city: string | null;
        region: string | null;
        status: string;
        creditsBalance: string;
        creditsUpdatedAt: string | null;
        currentPackageCode: string | null;
        createdAt: string | null;
        relation: 'OWNER' | 'SUB_MERCHANT';
        branchLabel?: string | null;
        subMerchantStatus?: string;
        joinedAt?: string | null;
      }
    | null;
  subscription: {
    id: string;
    packageCode: string;
    packageName: string | null;
    unlimited: boolean;
    creditsPerMonth: number | null;
    priceMinor: string | null;
    currency: string;
    status: string;
    startedAt: string | null;
    expiresAt: string | null;
    cancelledAt: string | null;
    autoRenew: boolean;
    createdAt: string;
  } | null;
  credits: {
    merchantId: string | null;
    ledgerBalance: string;
    lifetimeGranted: string;
    lifetimeConsumed: string;
    lifetimeRefunded: string;
    lifetimeExpired: string;
  };
  activity: {
    verifications: Record<string, number>;
    totalVerifications: number;
    transactions: number;
    sessions: number;
    activeSessions: number;
  };
  recentTransactions: Array<{
    id: string;
    bankCode: string | null;
    bankReference: string | null;
    amountMinor: string;
    status: string;
    paidAt: string | null;
    createdAt: string;
    verifiedBy: string | null;
    branchLabel: string | null;
  }>;
  recentCredits: Array<{
    id: string;
    type: string;
    amount: string;
    balanceAfter: string;
    reason: string | null;
    createdAt: string;
    actorName: string | null;
    actorEmail: string | null;
  }>;
  recentVerifications: Array<{
    id: string;
    bankCode: string | null;
    bankReference: string | null;
    amountMinor: string | null;
    status: string;
    source: string;
    createdAt: string;
  }>;
  auditTrail: Array<{
    id: string;
    actorType: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    actorName: string | null;
    actorEmail: string | null;
  }>;
  devices: Array<{
    id: string;
    platform: string;
    model: string | null;
    osVersion: string | null;
    appVersion: string | null;
    lastSeenAt: string | null;
    revokedAt: string | null;
    createdAt: string;
  }>;
}

export interface MerchantListRow {
  id: string;
  businessName: string;
  status: string;
  creditsBalance: string;
  packageCode: string | null;
  createdAt: string;
  owner: {
    id: string;
    fullName: string;
    phone: string;
    googleEmail: string | null;
  };
}

export interface MerchantListResponse {
  merchants: MerchantListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreditsOverview {
  totals: {
    granted: string;
    consumed: string;
    refunded: string;
    expired: string;
    netIssued: string;
    cachedBalanceTotal: string;
    merchants: number;
    merchantsWithCredits: number;
    unlimitedMerchants: number;
    ledgerRows: number;
    adjustments: string;
    adjustmentCount: number;
  };
  series: Array<{ date: string; granted: number; consumed: number }>;
  seriesTotals: { granted: number; consumed: number };
  topConsumers: Array<{
    merchantId: string;
    businessName: string;
    packageCode: string | null;
    creditsBalance: string;
    consumed: string;
  }>;
  lowBalance: Array<{
    merchantId: string;
    businessName: string;
    ownerName: string;
    ownerPhone: string;
    creditsBalance: string;
    packageCode: string | null;
  }>;
  recentAdjustments: Array<{
    id: string;
    merchantId: string | null;
    businessName: string | null;
    amount: string | null;
    newBalance: string | null;
    reason: string | null;
    createdAt: string;
    actorName: string | null;
    actorEmail: string | null;
  }>;
  generatedAt: string;
}

export interface MerchantCreditStat {
  merchantId: string;
  businessName: string;
  creditsBalance: string;
  consumed30d: string;
  lastTopUp: string | null;
}

export interface MerchantCreditStatsResponse {
  merchants: MerchantCreditStat[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  since: string;
}

export interface CreditAdjustmentResult {
  merchantId: string;
  businessName: string;
  amount: string;
  previousBalance: string;
  newBalance: string;
  ledgerTxId: string;
  reason: string;
}

// ── Phase C: notifications & review queue ────────────────────────────────

export type BroadcastTargetType = 'ALL' | 'ROLE' | 'USER';
export type BroadcastType = 'info' | 'warning' | 'system';
export type BroadcastStatus = 'DELIVERED' | 'PARTIAL' | 'FAILED' | 'IN_APP_ONLY';

export interface NotificationAudience {
  all: number;
  merchant: number;
  subMerchant: number;
}

export interface NotificationHistoryRow {
  id: string;
  title: string;
  body: string;
  type: string;
  targetType: BroadcastTargetType;
  targetRole: string | null;
  targetLabel: string;
  recipientCount: number;
  sentBy: string;
  sentAt: string;
  rowsWritten: number;
  delivered: number;
  failed: number;
  read: number;
  status: BroadcastStatus;
}

export interface NotificationHistoryResponse {
  notifications: NotificationHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface NotificationRecipientRow {
  userId: string;
  fullName: string | null;
  googleEmail: string | null;
  phone: string;
  pushedAt: string | null;
  pushError: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationDetailResponse {
  notification: NotificationHistoryRow;
  recipients: NotificationRecipientRow[];
}

export interface ReviewQueueRow {
  id: string;
  createdAt: string;
  bankCode: string | null;
  bankReference: string | null;
  amountMinor: string | null;
  reason: string;
  errorCode: string | null;
  reviewStatus: string | null;
  requestedBy: string | null;
  merchant: { id: string; businessName: string };
  submittedBy: string | null;
}

export interface ReviewQueueResponse {
  verifications: ReviewQueueRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ReviewDetailResponse {
  verification: {
    id: string;
    status: string;
    source: string;
    bankCode: string | null;
    bankReference: string | null;
    referenceNormalized: string | null;
    amountMinor: string | null;
    senderName: string | null;
    receiverName: string | null;
    paidAt: string | null;
    ocrRawText: string | null;
    ocrConfidence: number | null;
    clientOcrText: string | null;
    clientOcrConfidence: number | null;
    qrContent: string | null;
    qrType: string | null;
    adapterMetadata: Record<string, unknown> | null;
    errorCode: string | null;
    errorMessage: string | null;
    durationMs: number | null;
    attemptCount: number;
    startedAt: string;
    completedAt: string | null;
    createdAt: string;
  };
  merchant: { id: string; businessName: string; creditsBalance: string };
  submittedBy: { id: string; fullName: string | null; phone: string; googleEmail: string | null };
  receipt: {
    id: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    createdAt: string;
    expiresAt: string | null;
  } | null;
  review: {
    id: string;
    status: string;
    reason: string | null;
    resolution: string | null;
    resolvedAt: string | null;
    createdAt: string;
    requestedBy: { fullName: string | null } | null;
    resolvedBy: { fullName: string | null; googleEmail: string | null } | null;
  } | null;
}
