// ============================================================
// Yene Verify — Packages Service Unit Tests (Step 17)
//
// Pure read-model logic against a mocked repository: catalog
// projection/ordering, the 404 rule, the defensive nulls shape,
// upgrade-option filtering, and the daysRemaining ceil edge cases
// (expires today → 1, tomorrow → 1+, expired yesterday → 0).
// ============================================================

import { NotFoundError } from '../common/errors/domain-errors';
import { PackagesService } from './packages.service';
import type { PackagesRepository } from './packages.repository';
import type { Package, Subscription } from '@prisma/client';

const NOW = new Date('2026-10-29T12:00:00.000Z');

function pkg(overrides: Partial<Package> = {}): Package {
  return {
    code: 'BUSINESS',
    name: 'Business',
    description: null,
    priceMinor: 99900n,
    currency: 'ETB',
    creditsPerMonth: 400,
    unlimited: false,
    isCustom: false,
    displayOrder: 2,
    active: true,
    maxSubMerchants: 10,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as unknown as Package;
}

// A full e2e-style ACTIVE subscription — BUILD + edit. Rebuildable no-sub
// shapes flow through the same factory, so both commissioning paths and
// the nulls projection share one source of truth.
function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    merchantId: 'merch-1',
    packageCode: 'BUSINESS',
    status: 'ACTIVE',
    startedAt: new Date('2026-10-01T00:00:00.000Z'),
    expiresAt: new Date('2026-10-30T00:00:00.000Z'),
    cancelledAt: null,
    autoRenew: false,
    billingVerificationId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as unknown as Subscription;
}

const CATALOG = [
  pkg({ code: 'FREE', name: 'Free', displayOrder: 0, priceMinor: 0n, creditsPerMonth: 10 }),
  pkg({
    code: 'PREMIUM',
    name: 'Premium',
    displayOrder: 1,
    priceMinor: 19900n,
    creditsPerMonth: null,
    unlimited: true,
  }),
  pkg({ code: 'BUSINESS', name: 'Business', displayOrder: 2 }),
  pkg({
    code: 'BUSINESS_PRO',
    name: 'Business Pro',
    displayOrder: 3,
    priceMinor: 199900n,
    creditsPerMonth: null,
    unlimited: true,
  }),
  pkg({
    code: 'API',
    name: 'API Integration',
    displayOrder: 4,
    priceMinor: null,
    creditsPerMonth: null,
    unlimited: true,
    isCustom: true,
  }),
];

describe('PackagesService', () => {
  let service: PackagesService;

  const repoMock = {
    listActive: jest.fn(),
    findByCode: jest.fn(),
    findCurrentSubscription: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repoMock.listActive.mockResolvedValue(CATALOG);
    service = new PackagesService(repoMock as unknown as PackagesRepository);
  });

  // ── catalog ────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns only active packages, sorted by displayOrder, bigint as string', async () => {
      repoMock.listActive.mockResolvedValue([
        pkg({ code: 'BUSINESS', displayOrder: 2 }),
        pkg({ code: 'FREE', displayOrder: 0, priceMinor: 0n }),
        pkg({ code: 'API', displayOrder: 4, priceMinor: null }),
      ]);

      const res = await service.list();

      // Repository already ordered; service must not reshuffle.
      expect(res.data.map((p) => p.code)).toEqual(['BUSINESS', 'FREE', 'API']);
      expect(res.data[0].priceMinor).toBe('99900');
      expect(typeof res.data[0].priceMinor).toBe('string');
      expect(res.data[2].priceMinor).toBeNull(); // API has no listed price
    });

    it('projects the JSON-safe shape (no bigint, no Date fields)', async () => {
      const res = await service.list();
      const dto = res.data[0];
      expect(Object.keys(dto).sort()).toEqual(
        [
          'code',
          'currency',
          'creditsPerMonth',
          'description',
          'displayOrder',
          'isCustom',
          'name',
          'priceMinor',
          'unlimited',
        ].sort(),
      );
    });
  });

  describe('findOne()', () => {
    it('returns the package when found and active', async () => {
      repoMock.findByCode.mockResolvedValue(pkg());
      const res = await service.findOne('BUSINESS');
      expect(res.code).toBe('BUSINESS');
      expect(res.priceMinor).toBe('99900');
      expect(repoMock.findByCode).toHaveBeenCalledWith('BUSINESS');
    });

    it('throws NotFound for an unknown code', async () => {
      repoMock.findByCode.mockResolvedValue(null);
      await expect(service.findOne('INVALID')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws NotFound for an inactive package', async () => {
      repoMock.findByCode.mockResolvedValue(pkg({ active: false }));
      await expect(service.findOne('RETIRED')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  // ── my subscription ────────────────────────────────────────────────────

  describe('getMySubscription()', () => {
    function view(overrides: {
      subscription?: Subscription | null;
      packageName?: string;
      packageUnlimited?: boolean;
      packageDisplayOrder?: number;
      creditsBalance?: bigint;
    }) {
      return {
        subscription: overrides.subscription ?? sub(),
        packageName: overrides.packageName ?? 'Business',
        packageUnlimited: overrides.packageUnlimited ?? false,
        packageDisplayOrder: overrides.packageDisplayOrder ?? 2,
        creditsBalance: overrides.creditsBalance ?? 390n,
      };
    }

    it('active subscription returns the full data shape', async () => {
      repoMock.findCurrentSubscription.mockResolvedValue(view({}));

      const res = await service.getMySubscription('merch-1', NOW);

      expect(res.packageCode).toBe('BUSINESS');
      expect(res.packageName).toBe('Business');
      expect(res.status).toBe('ACTIVE');
      expect(res.subscriptionId).toBe('sub-1');
      expect(res.creditsBalance).toBe('390');
      expect(res.unlimited).toBe(false);
      expect(res.autoRenew).toBe(false);
      expect(res.startedAt).toBe('2026-10-01T00:00:00.000Z');
      // expires 2026-10-30T00:00Z vs now 2026-10-29T12:00Z → 0.5d → ceil → 1
      expect(res.daysRemaining).toBe(1);
      expect(res.canRenew).toBe(true);
      expect(res.lowBalance).toBe(false);
    });

    it('no subscription at all → defensive nulls (never throws)', async () => {
      repoMock.findCurrentSubscription.mockResolvedValue(null);

      const res = await service.getMySubscription('merch-1', NOW);

      expect(res).toEqual({
        subscriptionId: null,
        packageCode: null,
        packageName: null,
        status: null,
        startedAt: null,
        expiresAt: null,
        cancelledAt: null,
        autoRenew: false,
        unlimited: false,
        creditsBalance: '0',
        lowBalance: false,
        daysRemaining: null,
        canRenew: false,
        nextPackageUpgradeOptions: [],
      });
    });

    it('lowBalance mirrors the 14.2 rule: balance ≤ 20 on a finite plan only', async () => {
      repoMock.findCurrentSubscription.mockResolvedValue(view({ creditsBalance: 20n }));
      expect((await service.getMySubscription('merch-1', NOW)).lowBalance).toBe(true);

      repoMock.findCurrentSubscription.mockResolvedValue(view({ creditsBalance: 21n }));
      expect((await service.getMySubscription('merch-1', NOW)).lowBalance).toBe(false);

      repoMock.findCurrentSubscription.mockResolvedValue(
        view({ creditsBalance: 0n, packageUnlimited: true }),
      );
      // unlimited plans never show low-balance noise
      expect((await service.getMySubscription('merch-1', NOW)).lowBalance).toBe(false);

      // no subscription at all → not "low balance", just no plan yet
      repoMock.findCurrentSubscription.mockResolvedValue(null);
      expect((await service.getMySubscription('merch-1', NOW)).lowBalance).toBe(false);
    });

    it('unlimited flag flows from the package, not the subscription', async () => {
      repoMock.findCurrentSubscription.mockResolvedValue(
        view({ packageUnlimited: true, packageName: 'Business Pro' }),
      );
      expect((await service.getMySubscription('merch-1', NOW)).unlimited).toBe(true);
    });

    describe('nextPackageUpgradeOptions', () => {
      it('BUSINESS (order 2) → BUSINESS_PRO only (custom API package excluded)', async () => {
        repoMock.findCurrentSubscription.mockResolvedValue(view({}));

        const res = await service.getMySubscription('merch-1', NOW);

        expect(res.nextPackageUpgradeOptions).toEqual([
          { code: 'BUSINESS_PRO', name: 'Business Pro', priceMinor: '199900' },
        ]);
      });

      it('PREMIUM (order 1) → BUSINESS and BUSINESS_PRO only', async () => {
        repoMock.findCurrentSubscription.mockResolvedValue(
          view({ packageDisplayOrder: 1 }), // PREMIUM merchant
        );

        const res = await service.getMySubscription('merch-1', NOW);

        expect(res.nextPackageUpgradeOptions.map((o) => o.code)).toEqual([
          'BUSINESS',
          'BUSINESS_PRO',
        ]);
        expect(res.nextPackageUpgradeOptions.map((o) => o.code)).not.toContain('FREE');
        expect(res.nextPackageUpgradeOptions.map((o) => o.code)).not.toContain('API');
      });

      it('BUSINESS_PRO (order 3) → empty: only the custom API package outranks it', async () => {
        repoMock.findCurrentSubscription.mockResolvedValue(view({ packageDisplayOrder: 3 }));

        const res = await service.getMySubscription('merch-1', NOW);

        expect(res.nextPackageUpgradeOptions).toEqual([]);
      });
    });

    describe('daysRemaining edge cases (ceil, clamped at 0)', () => {
      it('expires in 12 hours → 1 (0.5 rounds UP)', async () => {
        repoMock.findCurrentSubscription.mockResolvedValue(
          view({ subscription: sub({ expiresAt: new Date(NOW.getTime() + 12 * 3_600_000) }) }),
        );
        expect((await service.getMySubscription('merch-1', NOW)).daysRemaining).toBe(1);
      });

      it('expires in exactly 2 days → 2', async () => {
        repoMock.findCurrentSubscription.mockResolvedValue(
          view({ subscription: sub({ expiresAt: new Date(NOW.getTime() + 2 * 86_400_000) }) }),
        );
        expect((await service.getMySubscription('merch-1', NOW)).daysRemaining).toBe(2);
      });

      it('expires a few hours AGO (today) → 0, not -0', async () => {
        repoMock.findCurrentSubscription.mockResolvedValue(
          view({ subscription: sub({ expiresAt: new Date(NOW.getTime() - 5 * 3_600_000) }) }),
        );
        expect((await service.getMySubscription('merch-1', NOW)).daysRemaining).toBe(0);
      });

      it('expired yesterday → 0 (clamped, never negative)', async () => {
        repoMock.findCurrentSubscription.mockResolvedValue(
          view({ subscription: sub({ expiresAt: new Date(NOW.getTime() - 1.5 * 86_400_000) }) }),
        );
        expect((await service.getMySubscription('merch-1', NOW)).daysRemaining).toBe(0);
      });

      it('null expiresAt (PENDING_PAYMENT) → null', async () => {
        repoMock.findCurrentSubscription.mockResolvedValue(
          view({ subscription: sub({ status: 'PENDING_PAYMENT', expiresAt: null }) }),
        );
        expect((await service.getMySubscription('merch-1', NOW)).daysRemaining).toBeNull();
      });
    });

    describe('canRenew', () => {
      it.each(['BUSINESS', 'BUSINESS_PRO', 'PREMIUM', 'API'] as const)(
        '%s → true',
        async (packageCode) => {
          repoMock.findCurrentSubscription.mockResolvedValue(
            view({ subscription: sub({ packageCode }) }),
          );
          expect((await service.getMySubscription('merch-1', NOW)).canRenew).toBe(true);
        },
      );

      it('FREE → false (provisioned at onboarding, not purchasable)', async () => {
        repoMock.findCurrentSubscription.mockResolvedValue(
          view({ subscription: sub({ packageCode: 'FREE' }) }),
        );
        expect((await service.getMySubscription('merch-1', NOW)).canRenew).toBe(false);
      });
    });
  });
});
