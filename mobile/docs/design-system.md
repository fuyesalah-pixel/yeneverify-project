# Yene Verify — Design System

> Version 1.0 · Updated: September 2026  
> This document is the human-readable companion to Step 2 of the build plan.  
> Agents: read this before touching any widget or theme file.

---

## 1. Philosophy

Yene Verify handles real money for real Ethiopian businesses. The UI must:

- **Communicate trust** — no playful, no cartoonish. Clean, precise, confident.
- **Feel instant** — everything under 10 seconds. Skeletons not spinners.
- **Be unambiguous** — verdicts are large, colored, and labelled. Never color-only.
- **Respect the user's device** — works in light and dark mode, respects reduced-motion, min 48px tap targets.

---

## 2. Color System

### The one-file rule
All hex values live exclusively in:
```
mobile/lib/core/theme/app_colors.dart
```
Grep test (must return zero results):
```sh
grep -R "#[0-9A-Fa-f]\{6\}" mobile/lib --exclude=app_colors.dart
grep -R "Colors\." mobile/lib --exclude-dir=core/theme
```

### Semantic tokens (use these names everywhere)

| Token                  | Light           | Dark            | Use                                  |
|------------------------|-----------------|-----------------|--------------------------------------|
| `background`           | `#FFFFFF`       | `#0A0A0A`       | Screen background                    |
| `surface`              | `#F7F8FA`       | `#141414`       | Cards, sheets                        |
| `surfaceAlt`           | `#F1F3F5`       | `#1C1C1C`       | Inputs, chips                        |
| `textPrimary`          | `#0A0A0A`       | `#FFFFFF`       | Main text                            |
| `textSecondary`        | `#5A5A5A`       | `#A1A1A1`       | Labels, captions                     |
| `textDisabled`         | `#9CA3AF`       | `#525252`       | Disabled text                        |
| `primaryAction`        | `#16A34A`       | `#39FF14`       | Buttons, links, active states        |
| `primaryActionPressed` | `#15803D`       | `#2EE010`       | Press feedback                       |
| `primaryActionDisabled`| `#A7D9B8`       | `#1F5A0F`       | Disabled buttons                     |
| `brandAccent`          | `#39FF14`       | `#39FF14`       | Icons, progress rings, highlights    |
| `success`              | `#16A34A`       | `#39FF14`       | VERIFIED verdict                     |
| `warning`              | `#F59E0B`       | `#FBBF24`       | Low credits, DUPLICATE verdict       |
| `error`                | `#DC2626`       | `#F87171`       | FAKE verdict, destructive actions    |
| `info`                 | `#2563EB`       | `#60A5FA`       | Neutral notices                      |
| `border`               | `#E5E7EB`       | `#262626`       | Card outlines, input borders         |
| `divider`              | `#F0F1F3`       | `#1A1A1A`       | List separators                      |
| `overlay`              | `rgba(0,0,0,.45)`| `rgba(0,0,0,.65)` | Modal scrim                        |
| `shimmerBase`          | `#EDEFF2`       | `#1A1A1A`       | Skeleton base                        |
| `shimmerHighlight`     | `#F7F8FA`       | `#262626`       | Skeleton sweep                       |

### ⚠️ Critical neon rule
`#39FF14` (brandAccent / dark primaryAction) **must never be used as a background for white text**. It fails WCAG (contrast ratio ≈ 1.3:1).

Use neon only for:
- Icon fills and strokes
- Progress ring strokes
- Active tab/nav indicators
- Small badge fills with dark text

---

## 3. Typography

Font: **Inter** (EN + numbers). **Noto Sans Ethiopic** (AM locale only).

| Token          | Size | Line-height | Weight | Use                          |
|----------------|------|-------------|--------|------------------------------|
| displayLarge   | 32   | 40          | 700    | Splash hero, big metrics     |
| displayMedium  | 28   | 36          | 700    | Result screen amount         |
| headingLarge   | 24   | 32          | 700    | Screen titles                |
| headingMedium  | 20   | 28          | 600    | Section headers              |
| headingSmall   | 18   | 24          | 600    | Card titles                  |
| bodyLarge      | 16   | 24          | 400    | Body text                    |
| bodyMedium     | 14   | 20          | 400    | Secondary body               |
| bodySmall      | 12   | 16          | 400    | Captions, timestamps         |
| labelLarge     | 16   | 20          | 600    | Button labels                |
| labelMedium    | 14   | 18          | 500    | Chips, tabs                  |
| labelSmall     | 12   | 16          | 500    | Badges                       |
| mono           | 14   | 20          | 500    | Transaction refs, IDs        |

Amounts always use tabular figures (`FontFeature.tabularFigures()`).  
Bank references always use `mono` + copy-on-tap via `ReferenceChip`.

---

## 4. Spacing (8pt Grid)

| Token  | Value | Common use                         |
|--------|-------|------------------------------------|
| xs     | 4px   | Icon-to-label gap, badge padding   |
| sm     | 8px   | Compact row gap                    |
| md     | 12px  | Inner padding on tight screens     |
| lg     | 16px  | Standard screen horizontal padding |
| xl     | 20px  | Bottom nav clearance               |
| xxl    | 24px  | Card padding, tablet screens       |
| xxxl   | 32px  | Section breaks                     |
| huge   | 40px  | Onboarding margins                 |
| giant  | 48px  | Splash centering                   |

---

## 5. Radii

| Token | Value | Use                                  |
|-------|-------|--------------------------------------|
| none  | 0     | Sharp edges, dividers                |
| sm    | 8px   | Chips, tags, badges                  |
| md    | 12px  | Buttons, text inputs                 |
| lg    | 16px  | Cards, modals                        |
| xl    | 20px  | Bottom sheet top corners             |
| pill  | 999px | Avatars, pills, circular buttons     |

---

## 6. Elevation

**Light mode** uses box shadows. **Dark mode** uses `border: 1px solid AppColors.border`.

| Level      | Use                              |
|------------|----------------------------------|
| elevation1 | Cards (default)                  |
| elevation2 | Floating buttons, bottom sheets  |
| elevation3 | Modals, dialogs                  |

---

## 7. Component Inventory

### Primitives
| Widget           | File                                  | Variants                                 |
|------------------|---------------------------------------|------------------------------------------|
| AppButton        | `widgets/buttons/app_button.dart`     | primary/secondary/ghost/danger × lg/md/sm |
| AppIconButton    | `widgets/buttons/app_icon_button.dart`| standard/filled/outlined/tinted          |
| AppTextField     | `widgets/inputs/app_text_field.dart`  | label, helper, error, prefix, suffix     |
| AppOtpField      | `widgets/inputs/app_otp_field.dart`   | 6-box, auto-advance, paste, shake        |
| AppPinField      | `widgets/inputs/app_pin_field.dart`   | 4/6 dot, shake+haptic on error           |

### Layout
| Widget             | File                                    | Notes                               |
|--------------------|-----------------------------------------|-------------------------------------|
| AppCard            | `widgets/layout/app_card.dart`          | default/outlined/tinted             |
| AppListTile        | `widgets/layout/app_list_tile.dart`     | leading, divider, destructive       |
| AppEmptyState      | `widgets/layout/app_empty_state.dart`   | icon/lottie, compact mode           |
| AppErrorState      | `widgets/layout/app_error_state.dart`   | icon, retry CTA                     |
| AppLoadingSkeleton | `widgets/layout/app_loading_skeleton.dart` | shimmer primitives + pre-built   |

### Feedback
| Widget          | File                                   | Notes                                |
|-----------------|----------------------------------------|--------------------------------------|
| AppSnackbar     | `widgets/feedback/app_snackbar.dart`   | Static show(), 4 variants            |
| AppDialog       | `widgets/feedback/app_dialog.dart`     | alert + confirm, danger variant      |
| AppBottomSheet  | `widgets/feedback/app_bottom_sheet.dart` | show<T>(), SheetAction rows        |

### Fintech-specific
| Widget            | File                                     | Notes                                     |
|-------------------|------------------------------------------|-------------------------------------------|
| AmountText        | `widgets/fintech/amount_text.dart`       | Integer minor units, 4 sizes, ETB suffix  |
| VerdictBadge      | `widgets/fintech/verdict_badge.dart`     | 6 verdicts, large/small                   |
| CreditMeter       | `widgets/fintech/credit_meter.dart`      | Animated ring, low/empty states           |
| BankLogo          | `widgets/fintech/bank_logo.dart`         | Asset + initials fallback                 |
| ReferenceChip     | `widgets/fintech/reference_chip.dart`    | Mono text + copy button                   |
| PhotoSourcePicker | `widgets/fintech/photo_source_picker.dart` | **Camera + Gallery ONLY. No QR. No paste.** |

---

## 8. Motion

| Duration | Value  | Use                                  |
|----------|--------|--------------------------------------|
| fast     | 150ms  | Micro feedback (icon swap)           |
| base     | 250ms  | Default transitions                  |
| slow     | 400ms  | Complex screen transitions           |

- Default curve: `Curves.easeOutCubic`
- Success celebration: `Curves.elasticOut`
- Never animate > 400ms
- Respect `MediaQuery.disableAnimations`

---

## 9. Haptics

| Trigger                          | Feedback              |
|----------------------------------|-----------------------|
| Verification VERIFIED            | `mediumImpact`        |
| Verification FAKE / ERROR        | `heavyImpact`         |
| Verification DUPLICATE           | `selectionClick`      |
| PIN wrong                        | `heavyImpact`         |
| Minor success (copy, save)       | `lightImpact`         |
| Low credits alert                | `vibrate`             |

---

## 10. Localization

- Files: `lib/l10n/app_en.arb`, `lib/l10n/app_am.arb`
- Config: `l10n.yaml` at project root
- Run `flutter gen-l10n` after editing ARB files
- Currency: `5,500.00 ETB` (suffix, never prefix)
- Dates: `14 Jul 2026, 2:08 PM`
- Amharic font: `NotoSansEthiopic`, loaded when `am` locale is active
- Zero hardcoded strings allowed in widgets

---

## 11. Accessibility

- All interactive elements: min 48×48px tap target
- Color is never the only indicator of state (always add icon + label)
- `Semantics` labels on `VerdictBadge` and other state-only widgets
- WCAG AA target: 4.5:1 for body text, 3:1 for large text/buttons
- `#39FF14` on `#FFFFFF` fails WCAG — never use as text background
- Test with TalkBack (Android) and VoiceOver (iOS) before release
