import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { log } from './helpers';

// ── packages.seed.ts — ALWAYS RUNS (all profiles) ────────────────────────
// Source of truth: shared/constants/packages.json
// Upserts by package code. Never deletes.

interface PackageJson {
  code: string;
  name: string;
  nameAm?: string;
  priceMinor: number | null;
  currency: string;
  creditsPerMonth: number | null;
  unlimited: boolean;
  custom?: boolean;
  features?: string[];
  paymentRequired?: boolean;
  isDefault?: boolean;
}

export async function seedPackages(prisma: PrismaClient): Promise<void> {
  const raw = readFileSync(
    resolve(__dirname, '../../../shared/constants/packages.json'),
    'utf8',
  );
  const packages: PackageJson[] = JSON.parse(raw);

  let count = 0;
  for (const [i, p] of packages.entries()) {
    await prisma.package.upsert({
      where: { code: p.code as any },
      create: {
        code: p.code as any,
        name: p.name,
        priceMinor: p.priceMinor != null ? BigInt(p.priceMinor) : null,
        currency: p.currency ?? 'ETB',
        creditsPerMonth: p.creditsPerMonth ?? null,
        unlimited: p.unlimited ?? false,
        isCustom: p.custom ?? false,
        displayOrder: i,
        active: true,
      },
      update: {
        name: p.name,
        priceMinor: p.priceMinor != null ? BigInt(p.priceMinor) : null,
        creditsPerMonth: p.creditsPerMonth ?? null,
        unlimited: p.unlimited ?? false,
        isCustom: p.custom ?? false,
        displayOrder: i,
        active: true,
      },
    });
    count++;
  }

  log('packages', count);
}
