// ============================================================
// Yene Verify â€” Waitlist Repository
// Thin Prisma access layer for waitlist_emails.
// ============================================================

import { PrismaService } from '../prisma/prisma.service';
import type { WaitlistEmail } from '@prisma/client';

export type WaitlistEmailRow = WaitlistEmail;

export class WaitlistRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<WaitlistEmailRow | null> {
    return this.prisma.waitlistEmail.findUnique({ where: { email } });
  }

  async create(data: {
    email: string;
    source?: string | null;
    ip?: string | null;
  }): Promise<WaitlistEmailRow> {
    return this.prisma.waitlistEmail.create({
      data: {
        id: crypto.randomUUID(),
        email: data.email,
        source: data.source ?? null,
        ip: data.ip ?? null,
      },
    });
  }
}
