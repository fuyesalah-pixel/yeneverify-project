# Emulator Setup

## Do NOT use the default AVD for manual QA

The default `yene-pixel` AVD (API 33, 1080x2400, 2 GB RAM, software GL)
renders at 1-7 FPS. This is a platform-level limitation (SwiftShader
rasterization), not an app bug.

Measured on 2026-11-03 (see `docs/ops/step22b-*.png`, `docs/ops/diag-*.png`):

| Layer | Measurement |
| --- | --- |
| Launcher (`dumpsys gfxinfo`) | 187 frames, 89.84% janky, p50 150 ms (~6.7 FPS), p90 500 ms (2 FPS) |
| SystemUI frame swaps (`EGL_emulation app_time_stats`) | one frame every 4.6-60 s while idle |
| App on splash (earlier session) | `avg=97.95 ms` / frame, then 611-739 ms (1.1-1.6 FPS), `Skipped 398-444 frames` |
| App first frame (this session) | **never presented** — launch icon still on screen after 5 min |
| CPU | 377-385% of 400% idle, app threads sleeping → not CPU-bound |
| Renderer | `ro.hardware.egl=emulation`, `ro.hardware.vulkan=ranchu`, `ro.kernel.qemu.gles` unset |

The app is waiting on the compositor, not stuttering in Dart: a code audit of
the auth/splash path found zero hazards (no ref.watch loops, no setState in
build, no uncancelled periodic timers, no heavy build work, no provider
cascade, no repeating tickers).

## Recommended AVD for manual QA

- Device: Pixel 4
- System image: API 30 or API 31, x86_64 (not API 33 — heavier system image)
- Resolution: 720 x 1280 (default for Pixel 4; half the pixels of the default AVD)
- RAM: 3072 MB
- VM heap: 512 MB
- Graphics: **Hardware - GLES 2.0** (critical)
- Boot: Cold boot

## Verify the AVD is healthy before QA

```
adb shell dumpsys gfxinfo com.google.android.apps.launcher
```

Expected: p50 ~16 ms (60 FPS), p90 < 32 ms (30 FPS).
If p50 > 100 ms, GPU accel didn't take; retry (update the host GPU driver,
confirm VT-x/SVM is enabled in BIOS).

`scripts/check-emulator-health.ps1` wraps this check and exits non-zero when
the emulator is too slow for visual review.

## For CI / automated testing

Debug APK builds and integration tests work fine on the slow emulator because
they don't require 60 FPS rendering. `mobile/integration_test/verify_flow_test.dart`
passed on the default AVD (whole flow in 3758 ms) even while the UI rendered
at ~1 FPS.

## For manual visual QA (verdict screen, onboarding screens, etc.)

Use the fast AVD above, or a physical device. The default AVD is not suitable
for visual review.
