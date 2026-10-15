# assets/lottie/

Lottie JSON animation files for key UI moments.

## Required files
| File                  | Used by                                        |
|-----------------------|------------------------------------------------|
| `success.json`        | Verification VERIFIED result celebration       |
| `loading.json`        | Verification PENDING state (progress ring)     |
| `empty.json`          | Generic empty state (optional fallback)        |
| `error.json`          | Verification FAKE/ERROR result (optional)      |

## Rules
- Keep each file under 50KB. Larger = noticeable load time.
- Use https://lottiefiles.com for free, high-quality animations.
- Ensure animations respect color tokens — prefer assets that use
  solid `#16A34A` / `#39FF14` / `#DC2626` so they match the theme.
- Load via the `lottie` package: `Lottie.asset('assets/lottie/success.json')`.
- Always set `repeat: false` for one-shot celebrations.
- Always check `MediaQuery.disableAnimations` and fall back to a
  static icon if the user has reduced motion enabled.
