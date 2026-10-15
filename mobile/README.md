# Yene Verify Mobile

Flutter client for merchants and sub-merchants. The app contains **no
secrets**. All privileged operations, bank credentials, signing keys, and
provider calls are proxied through the backend.

## Build configuration

`lib/core/env/app_env.dart` reads compile-time values with
`String.fromEnvironment` / `int.fromEnvironment` / `bool.fromEnvironment`.
The documented public key set is in [`dart_defines.example.json`](dart_defines.example.json).
Real `dart_defines.dev.json`, `dart_defines.staging.json`, and
`dart_defines.prod.json` files are ignored by Git so future non-public build
configuration can be introduced without changing the rule.

Example Android emulator build:

```bash
cd mobile
flutter run \
  --dart-define=APP_ENV=development \
  --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1 \
  --dart-define=API_TIMEOUT_MS=20000 \
  --dart-define=BUILD_FLAVOR=dev
```

For an Android emulator, the host machine is `10.0.2.2`. For an iOS
simulator, use `localhost` (or `127.0.0.1`) for a backend running on the
same Mac. A physical device must use the development machine's LAN address
and an explicitly allowed CORS/network policy.

Build flavors are intentionally kept separate from secrets:

| Flavor | API target | Logs/tools | Sentry |
|--------|------------|------------|--------|
| `dev` | local Docker backend | enabled | off by default |
| `staging` | staging API | tools hidden | staging DSN if provisioned |
| `prod` | HTTPS production API | disabled | production DSN if provisioned |

Platform flavor wiring is completed in the mobile platform setup step; this
step supplies the typed configuration boundary and the public key manifest.

## Security boundary

- Never add API keys, database URLs, JWT signing keys, R2 keys, FCM private
  keys, or bank credentials to this directory or to a `--dart-define`.
- Sentry's DSN is treated as public client configuration and is empty in dev.
- Tokens, when implemented, belong in `flutter_secure_storage`, not in a
  define file or shared preferences.
