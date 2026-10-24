# Yene Verify — Ops Backlog

Running list of deferred work with a real trigger condition. Items are
ordered by when they become relevant, not by priority alone.

## 1. Live smoke test per bank (verification quality)

One manual smoke run per bank from an Ethiopian egress once all seven
adapters exist. Closes the "fixtures only" gap: parser verdicts against
real bank DOM instead of sanitized agent-written fixtures.

- [x] Telebirr — smoke script exists ([backend/scripts/telebirr-smoke.ts](../../backend/scripts/telebirr-smoke.ts)); blocked on an egress that can reach `transactioninfo.ethiotelecom.et` (TCP-level blocked from current dev machine — see item 2).
- [ ] Awash (`awashpay.awashbank.com:8225`) — needs the same one-off script + real reference.
- [ ] Dashen, Abyssinia, M-Pesa, Zemen — run after each adapter lands.

## 2. Ethiopian egress for Telebirr in production (launch blocker)

Telebirr's receipt host refuses TCP from outside Ethiopia (verified: DNS
resolves, connect times out). Before launch, pick one:

- (a) host verification workers on a VPS with an Ethiopian IP in-region;
- (b) route Telebirr (and any other geo-blocked) adapter calls through an Ethiopian proxy/relay;
- (c) negotiate direct API access with Ethio Telecom.

Determines whether Telebirr verification can work in production at all.

## 3. Dashen auth API fallback (future phase)

The multi-endpoint HTTP adapter (13D.4) is the MVP "partial-verification"
path. A full verification path for Dashen needs their receipt-check API,
which requires credentials the project does not have yet.

## 4. `@nestjs/axios` retry tuning (deferred)

Decide whether adapter HTTP calls should retry at the axios/HTTP layer in
addition to AdapterBase's retry-with-backoff. Base-class retries already
bound total attempts; an extra layer risks multiplying requests against
flaky bank endpoints.
