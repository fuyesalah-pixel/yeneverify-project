// ============================================================
// Yene Verify — Package response DTOs (Step 17)
//
// Read-only catalog. bigint priceMinor crosses the API as a
// string (or null for the custom-priced API package).
// ============================================================

/** GET /packages → 200 (public pricing-page data) */
export interface PackageResponseDto {
  code: string;
  name: string;
  description: string | null;
  /** bigint as string; null when a package has no listed price (API). */
  priceMinor: string | null;
  currency: string;
  /** null for unlimited plans. */
  creditsPerMonth: number | null;
  unlimited: boolean;
  isCustom: boolean;
  displayOrder: number;
}

/** GET /packages → 200 */
export interface PackageListResponseDto {
  data: PackageResponseDto[];
}
