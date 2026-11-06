import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { MockProvider } from '../ocr/providers/mock.provider';
import { AdapterRegistry } from '../verification/adapters/adapter.registry';

/** Hard ceiling per bank probe so one dead host cannot stall the response. */
const PROBE_TIMEOUT_MS = 1500;

/** Probing hits third-party hosts; a short cache keeps the debug sheet cheap. */
const PROBE_CACHE_MS = 60_000;

/**
 * Display-only probe URLs, one per bank that has a single stable base URL.
 * Adapters own their real request URLs (and their fallbacks); this map exists
 * only so /health/ocr can answer "can this host reach the bank at all?".
 */
const PROBE_URLS: Record<string, string> = {
  CBE: 'https://apps.cbe.com.et:100/',
  AWASH: 'https://awashpay.awashbank.com:8225/',
  TELEBIRR: 'https://transactioninfo.ethiotelecom.et/',
};

export interface BankProbe {
  bankCode: string;
  /** null when the bank has no single probe URL (adapter-owned, multi-URL). */
  endpoint: string | null;
  /** null = not probed (no endpoint) — never "assumed reachable". */
  reachable: boolean | null;
  status: number | null;
  latencyMs: number | null;
  /** Short error name only; never a raw stack or request URL. */
  error: string | null;
}

export interface OcrDiagnostics {
  provider: string;
  fixtures: number;
  hint: string;
  bankAdapterMock: boolean;
  banks: BankProbe[];
}

/**
 * Read-only diagnostics behind GET /health/ocr (development troubleshooting).
 *
 * It answers the three questions the 0/7 receipt report raised: is OCR real or
 * mocked, are mock fixtures loaded, and is the bank host reachable from here.
 */
@Injectable()
export class OcrDiagnosticsService {
  private cachedBanks: { at: number; banks: BankProbe[] } | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly mock: MockProvider,
    private readonly registry: AdapterRegistry,
  ) {}

  async snapshot(): Promise<OcrDiagnostics> {
    const provider = this.config.ocr.provider;
    const fixtures = provider === 'mock' ? this.mock.fixtureCount : 0;

    return {
      provider,
      fixtures,
      hint:
        provider === 'mock'
          ? fixtures === 0
            ? 'ocr: mock, no fixtures — real receipts will fail'
            : `ocr: mock, ${fixtures} fixtures`
          : `ocr: ${provider}`,
      bankAdapterMock: this.config.bankAdapters.mock,
      banks: await this.banks(),
    };
  }

  private async banks(): Promise<BankProbe[]> {
    if (this.cachedBanks && Date.now() - this.cachedBanks.at < PROBE_CACHE_MS) {
      return this.cachedBanks.banks;
    }

    const codes = this.registry.list() as string[];
    const probed = await Promise.all(
      codes.map(async (bankCode): Promise<BankProbe> => {
        const endpoint = PROBE_URLS[bankCode] ?? null;
        if (!endpoint) {
          return {
            bankCode,
            endpoint: null,
            reachable: null,
            status: null,
            latencyMs: null,
            error: null,
          };
        }
        const result = await this.probe(endpoint);
        return { bankCode, endpoint, ...result };
      }),
    );

    this.cachedBanks = { at: Date.now(), banks: probed };
    return probed;
  }

  private async probe(url: string): Promise<{
    reachable: boolean;
    status: number | null;
    latencyMs: number;
    error: string | null;
  }> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      // Any HTTP status — including 500 — proves the host is reachable; the
      // status is reported so a 403/500 is not mistaken for "works".
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': this.config.bankAdapters.userAgent },
      });
      await response.body?.cancel().catch(() => undefined);
      return {
        reachable: true,
        status: response.status,
        latencyMs: Date.now() - started,
        error: null,
      };
    } catch (error) {
      const cause = (error as { cause?: { code?: string } }).cause;
      const name = cause?.code ?? (error instanceof Error ? error.name : 'UNKNOWN');
      return {
        reachable: false,
        status: null,
        latencyMs: Date.now() - started,
        error: name,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
