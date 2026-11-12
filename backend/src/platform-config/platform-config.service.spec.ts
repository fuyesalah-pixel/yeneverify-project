import { PlatformConfigService, PAYMENT_SETTINGS_KEY } from './platform-config.service';

const prismaMock: any = {
  featureFlag: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  platformSetting: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

const configMock: any = {
  features: {
    manualReviewEnabled: true,
    billingVerificationEnabled: false,
    mlInsightsEnabled: false,
  },
  payment: {
    accountName: 'Yene Verify',
    destinationCbe: '1000123456789',
    destinationTelebirr: '+251911000111',
    instructionsNote: 'Pay the exact amount.',
  },
};

function buildService(): PlatformConfigService {
  return new PlatformConfigService(prismaMock, configMock);
}

describe('PlatformConfigService', () => {
  let service: PlatformConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = buildService();
  });

  describe('listFlags()', () => {
    it('uses the env default when no row exists and a row value when it does', async () => {
      prismaMock.featureFlag.findMany.mockResolvedValue([
        {
          key: 'ff_manual_review_enabled',
          enabled: false,
          description: 'Custom description',
          updatedAt: new Date('2026-11-12T08:00:00Z'),
        },
      ]);

      const flags = await service.listFlags();

      expect(flags).toHaveLength(5);
      expect(flags[0]).toMatchObject({
        key: 'ff_manual_review_enabled',
        enabled: false,
        envDefault: true,
        description: 'Custom description',
        updatedAt: '2026-11-12T08:00:00.000Z',
      });
      expect(flags.find((f) => f.key === 'ff_billing_verification_enabled')).toMatchObject({
        enabled: false,
        envDefault: false,
      });
      expect(flags.find((f) => f.key === 'ff_credit_low_push_enabled')).toMatchObject({
        enabled: false,
        envDefault: null,
        envKey: null,
      });
    });
  });

  describe('setFlag()', () => {
    it('upserts the flag and reports the previous value', async () => {
      prismaMock.featureFlag.findUnique.mockResolvedValue({
        key: 'ff_ml_insights_enabled',
        enabled: false,
      });
      prismaMock.featureFlag.upsert.mockResolvedValue({
        key: 'ff_ml_insights_enabled',
        enabled: true,
        description: 'Use ML-based analytics',
        updatedAt: new Date('2026-11-12T09:00:00Z'),
      });

      const result = await service.setFlag('ff_ml_insights_enabled', true);

      expect(prismaMock.featureFlag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'ff_ml_insights_enabled' },
          update: { enabled: true },
        }),
      );
      expect(result.previous).toBe(false);
      expect(result.flag).toMatchObject({ key: 'ff_ml_insights_enabled', enabled: true });
    });

    it('rejects keys outside the catalogue', async () => {
      await expect(service.setFlag('ff_unknown', true)).rejects.toThrow('Unknown feature flag');
      expect(prismaMock.featureFlag.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getPaymentInstructions()', () => {
    it('falls back to env values before an admin saves anything', async () => {
      prismaMock.platformSetting.findUnique.mockResolvedValue(null);

      const result = await service.getPaymentInstructions();

      expect(result).toMatchObject({
        accountName: 'Yene Verify',
        cbeAccountNumber: '1000123456789',
        telebirrPhoneNumber: '+251911000111',
        instructionsNote: 'Pay the exact amount.',
        source: 'env',
        updatedAt: null,
      });
    });

    it('prefers stored values over env', async () => {
      prismaMock.platformSetting.findUnique.mockResolvedValue({
        key: PAYMENT_SETTINGS_KEY,
        value: {
          accountName: 'Yene Verify PLC',
          cbeAccountNumber: '1000999888777',
          telebirrPhoneNumber: '+251922000222',
          instructionsNote: 'Send the exact amount.',
        },
        updatedAt: new Date('2026-11-12T09:30:00Z'),
      });

      const result = await service.getPaymentInstructions();

      expect(result).toMatchObject({
        accountName: 'Yene Verify PLC',
        cbeAccountNumber: '1000999888777',
        telebirrPhoneNumber: '+251922000222',
        source: 'db',
        updatedAt: '2026-11-12T09:30:00.000Z',
      });
    });
  });

  describe('setPaymentInstructions()', () => {
    it('upserts the row with the acting admin and returns before/after', async () => {
      prismaMock.platformSetting.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
        key: PAYMENT_SETTINGS_KEY,
        value: {
          accountName: 'Yene Verify',
          cbeAccountNumber: '1000999888777',
          telebirrPhoneNumber: '+251911000111',
          instructionsNote: 'Pay the exact amount.',
        },
        updatedAt: new Date('2026-11-12T10:00:00Z'),
      });

      const result = await service.setPaymentInstructions(
        {
          accountName: 'Yene Verify',
          cbeAccountNumber: '1000999888777',
          telebirrPhoneNumber: '+251911000111',
          instructionsNote: 'Pay the exact amount.',
        },
        'admin-1',
      );

      expect(prismaMock.platformSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: PAYMENT_SETTINGS_KEY },
          update: expect.objectContaining({ updatedByUserId: 'admin-1' }),
        }),
      );
      expect(result.previous.source).toBe('env');
      expect(result.next).toMatchObject({ cbeAccountNumber: '1000999888777', source: 'db' });
    });
  });
});
