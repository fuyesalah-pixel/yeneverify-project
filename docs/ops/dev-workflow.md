# Dev Workflow Notes

## Simulating lockout expiry

PIN lockout lasts 15 minutes (`PIN_LOCKOUT_SECONDS` in
`backend/src/common/constants/pin-policy.ts`). Waiting out the timer is
impractical during manual testing, so simulate expiry by clearing the lockout
state instead:

- Prisma Studio: open `users`, set `pin_locked_until` to `NULL` (and
  optionally reset `pin_failed_attempts` to `0`).
- psql:

  ```sql
  UPDATE users
     SET pin_locked_until = NULL,
         pin_failed_attempts = 0
   WHERE phone = '+2519XXXXXXXX';
  ```

The next PIN attempt is treated as if the lockout window has elapsed.
