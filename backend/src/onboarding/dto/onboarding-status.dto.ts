// ============================================================
// Yene Verify — Onboarding Status DTO
// ============================================================

import { z } from 'zod';

export const OnboardingStepSchema = z.enum([
  'COMPLETE',
  'MERCHANT_PROFILE',
  'SUB_MERCHANT_ACCEPT',
  'SUB_MERCHANT_PROFILE',
]);

export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;

export const PendingInviteDtoSchema = z.object({
  id: z.string().uuid(),
  merchantName: z.string(),
  branchLabel: z.string().optional(),
});

export type PendingInviteDto = z.infer<typeof PendingInviteDtoSchema>;

export const OnboardingStatusDtoSchema = z.object({
  needsOnboarding: z.boolean(),
  step: OnboardingStepSchema,
  pendingInvite: PendingInviteDtoSchema.optional(),
});

export type OnboardingStatusDto = z.infer<typeof OnboardingStatusDtoSchema>;
