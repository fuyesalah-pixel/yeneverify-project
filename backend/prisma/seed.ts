// ============================================================
// Yene Verify — Prisma Seed Entry Point
// Invoked by: npx prisma db seed
// Uses the modular seed system in prisma/seed/
// ============================================================

import { PrismaClient } from "@prisma/client";
import { runSeed, resolveProfile } from "./seed/index";

async function main() {
  const prisma = new PrismaClient();
  const profile = resolveProfile();

  try {
    await runSeed(prisma, profile);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌ Seed failed:", e.message ?? e);
  process.exit(1);
});
