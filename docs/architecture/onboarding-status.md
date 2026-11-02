# Onboarding status: single source of truth

## Decision

`GET /onboarding/status` is the **only** source for onboarding routing
decisions. `GET /auth/me` is used for user identity and real PIN state
(`pinSetAt`), never for onboarding.

The response shape is:

```json
{ "needsOnboarding": true, "step": "MERCHANT_PROFILE", "pendingInvite": null }
```

- `step` — `MERCHANT_PROFILE` | `SUB_MERCHANT_ACCEPT` | `COMPLETE`
- `pendingInvite` — `{ id, merchantName, branchLabel? }` for a sub-merchant
  invite, otherwise `null`

## Why

Previously the app derived `needsOnboarding` from `/auth/me`'s
`ownedMerchant == null` while `/onboarding/status` was wired but unused. The
two answers could disagree (and `/auth/me` was onboarding-gated, so the
derivation only worked *after* onboarding). Backend fix
`v1.2.1-mobile-plus-fixes` removed that guard, but the client still needs one
authority so Step 22 cannot introduce redirect loops.

## Flow

1. Auth state resolves as `unauthenticated` / `pinSetup` / `locked` /
   `unlocked`. There is deliberately **no** `AuthStatus.needsOnboarding` —
   auth answers "is the session usable?", onboarding is a separate concern.
2. When the session becomes `unlocked` (after biometric enrollment or a PIN /
   biometric unlock), `AuthNotifier` calls `/onboarding/status` and stores
   `needsOnboarding`, `onboardingStep`, and `pendingInvite` on `AuthState`.
3. The router's pure `authRedirect()` sends `unlocked + needsOnboarding` to
   `/onboarding`; `unlocked + !needsOnboarding` to `/dashboard` (or leaves other
   authenticated routes alone).
4. After Step 22 creates the merchant profile, refresh the status (the
   dashboard has a debug refresh button) so `needsOnboarding` flips to false
   and the guard releases `/dashboard`.

## Failure behavior

If the status call fails during unlock, the session still unlocks with the
previous flags (default `false`). The dashboard's "Dev: refresh onboarding
status" button retries; a production retry hook belongs to Step 22.

## Implementation

- `mobile/lib/features/auth/data/models/auth_models.dart` — `OnboardingStatus`,
  `PendingInvite`
- `mobile/lib/features/auth/domain/auth_notifier.dart` — hydration in
  `completeEnrollment` / `_applyUnlockResult`, `refreshOnboardingStatus`
- `mobile/lib/core/router/auth_redirect.dart` — redirect matrix
- `mobile/lib/features/onboarding/presentation/screens/onboarding_placeholder_screen.dart`
  — Step 22 replaces this placeholder
