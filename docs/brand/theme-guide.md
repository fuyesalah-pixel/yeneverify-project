# Yene Verify — Theme Guide

> Last updated: 2026-09-24 | Owner: OpenCode
> Canonical location: `docs/brand/theme-guide.md` (mirrored from `mobile/docs/`)

---

## How to access theme tokens in a widget

```dart
// 1. Import the extension
import 'package:yene_verify/core/theme/app_colors_extension.dart';

// 2. Inside build():
final colors = context.colors;

Container(color: colors.surface)
Text('Hello', style: AppTypography.bodyLarge.copyWith(color: colors.textPrimary))
SizedBox(height: AppSpacing.lg)
Container(decoration: BoxDecoration(borderRadius: AppRadii.radiusMd))
```

Never use:
```dart
// ❌ Wrong
Color(0xFF16A34A)
Colors.green
Colors.black87
16.0  // hardcoded font size
BorderRadius.circular(16)  // hardcoded radius
```

---

## How to add a new color token

1. **Stop and ask yourself**: is this truly a new semantic concept, or can I reuse an existing token?
2. If new, open `core/theme/app_colors.dart`.
3. Add the field to the `AppColors` class with a doc comment explaining its purpose.
4. Add the light value under `AppColors.light` with a hex comment.
5. Add the dark value under `AppColors.dark` with a hex comment.
6. Add the field to `copyWith()` and `lerp()`.
7. Update `docs/design-system.md` color table.
8. Do NOT add a color that is not in the palette without approval from Fuad.

```dart
// Example addition
/// Highlight color for verified amount on the result hero card.
final Color verifiedHighlight;

// In light:
verifiedHighlight: Color(0xFFDCFCE7),  // green-100

// In dark:
verifiedHighlight: Color(0xFF052E16),   // green-950
```

---

## How to add a new text style

1. Open `core/theme/app_typography.dart`.
2. Add a static `const TextStyle` with a doc comment.
3. If it belongs on the Material `TextTheme`, add it to `textTheme` getter.
4. Do NOT invent font sizes. Use the existing scale first.

```dart
/// Mono small — for 2FA codes, short IDs.
static const TextStyle monoSmall = TextStyle(
  fontFamily: _inter,
  fontSize: 12,
  height: 1.333,
  fontWeight: FontWeight.w500,
  letterSpacing: 0.5,
  fontFeatures: tabularFigures,
);
```

---

## How to add a new spacing value

The 8pt grid covers nearly all cases. If you need a value not in the scale:
1. Check if `xs`, `sm`, `md`, `lg`, `xl`, `xxl`, `xxxl`, `huge`, `giant` covers it.
2. If not, add it to `core/theme/app_spacing.dart` with a doc comment.
3. Only add multiples of 4 (2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64...).

---

## How to add a new widget

1. Create the file in the correct folder:
   - Primitive UI → `core/widgets/buttons/`, `inputs/`, `layout/`, `feedback/`
   - Finance-specific → `core/widgets/fintech/`
   - Feature-specific → `features/{feature}/presentation/widgets/`

2. Never import a raw color. Use `context.colors.*`.

3. Never hardcode a number. Use `AppSpacing.*`, `AppRadii.*`, `AppTypography.*`.

4. Add a doc comment block explaining:
   - What the widget does.
   - When to use it.
   - When NOT to use it.
   - Example usage.

5. Add light + dark support by reading from `context.colors`.

---

## How to add a localized string

1. Open `lib/l10n/app_en.arb` and add the key:
```json
"myNewKey": "My new string",
"@myNewKey": { "description": "Explain where this is used" }
```

2. Open `lib/l10n/app_am.arb` and add the Amharic translation.

3. Run:
```sh
flutter gen-l10n
```

4. Use in a widget:
```dart
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

// In build():
final l10n = AppLocalizations.of(context);
Text(l10n.myNewKey)
```

---

## How to switch themes

The app uses `ThemeMode.system` by default. To add a manual toggle:

1. Create a `Notifier<ThemeMode>` provider in `features/settings/`.
2. Read it in `app.dart` and pass to `MaterialApp.themeMode`.
3. Persist the preference via `flutter_secure_storage` or `Isar`.

The theme files themselves do not need to change — `AppTheme.lightTheme()` and `AppTheme.darkTheme()` are already correct.

---

## Verification checklist before committing widget code

```
□ No hex values outside app_colors.dart
□ No Colors.* outside core/theme/
□ No hardcoded font sizes, radii, or spacing
□ All strings in ARB files (no hardcoded English)
□ Widget has doc comment with when-to-use / when-not-to-use
□ Widget reads colors from context.colors
□ Widget respects disabled state
□ Min tap target is 48×48px for interactive elements
□ flutter analyze returns zero warnings
```
