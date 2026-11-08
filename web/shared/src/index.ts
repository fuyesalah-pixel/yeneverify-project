export type WaitlistRequest = {
  email: string;
  source?: string;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'https://api.mekatanker.shop/api/v1';

export async function postJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) return { ok: false, error: (json as { message?: string }).message ?? 'Request failed', status: res.status };
    return { ok: true, data: json as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export type PackageInfo = {
  code: string;
  name: string;
  nameAm?: string;
  priceMinor: number | null;
  currency: string;
  creditsPerMonth: number | null;
  unlimited: boolean;
  custom: boolean;
  maxSubMerchants: number | null;
  features: string[];
  featuresAm?: string[];
  paymentRequired: boolean;
  isDefault?: boolean;
};

export type BankInfo = {
  code: string;
  name: string;
  nameAm?: string;
  short: string;
  fallbackColor?: string;
  adapterStatus?: string;
};
