# Yene Verify — Design Principles (locked, Step 20)

The "luxury fintech" rules every screen in this app inherits. Wise-style,
not gold-gradient.

## Core rules

1. **Whitespace is the primary luxury signal.** When in doubt, add space.
2. **One primary action per screen.** Never two filled `AppButton.primary`.
3. **Every screen has ONE focal element** (a big amount, a verdict badge,
   a heading).
4. **No emojis anywhere.**
5. **No gradients** — exceptions: the splash treatment and the verdict hero
   card only, if later steps need depth.
6. **No rounded corners > 20px** (`AppRadii.radiusLg` is the ceiling).
7. **No multiple accent colors.** Green is the accent. Everything else is
   semantic (success/warning/error/info) used sparingly.
8. **No playful illustrations.** Abstract geometric shapes only, if any.
9. **Icons: Lucide only** — or Material outlined icons with matched stroke
   weight. Never filled icon sets mixed with outlined.

## Typography

10. Hierarchy comes from **size and weight, never color**. Body text does
    not glow; the `textSecondary` token is for de-emphasis, not decoration.
11. Inter for UI, Noto Sans Ethiopic for Amharic. Never another family.
12. Tabular figures for all amounts and reference codes (`AppTypography.mono`).

## Components

13. Buttons: 48px+ min height, 12px radius, `#16A34A` (light) /
    `#00D54B` (dark) — always from `AppColors.primaryAction`, never raw hex.
14. Cards: 16px radius, thin border (dark) or subtle shadow (light).
15. Feedback: **haptics on success (medium) and error (heavy) only** —
    never on scroll, never on focus.
16. Animations: 150–400ms, `Curves.easeOutCubic` default. No bounces.
17. Skeleton loaders (`AppShimmer`) instead of spinners for content areas.

## Color law

18. **Never use `Colors.green`, `Colors.black`, or any hex outside
    `app_colors.dart`.** The palette lives in one file; every widget reads
    `context.colors.*`. Light and dark palettes are separate instances.
19. In light mode the primary action is `#16A34A` (WCAG-safe on white) and
    `#00D54B` is accent-only. In dark mode `#00D54B` is the primary action
    — the Cash App pattern of bright green on near-black.
