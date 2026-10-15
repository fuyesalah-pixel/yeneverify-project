import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Convenience extension so widgets can write `context.colors.primaryAction`
/// instead of `Theme.of(context).extension<AppColors>()!.primaryAction`.
///
/// Usage:
/// ```dart
/// import 'package:yene_verify/core/theme/app_colors_extension.dart';
///
/// // Inside a Widget build:
/// final colors = context.colors;
/// Container(color: colors.surface);
/// ```
extension AppColorsX on BuildContext {
  /// Returns the [AppColors] extension from the current theme.
  /// Throws if the extension is not registered (should never happen in production).
  AppColors get colors => Theme.of(this).extension<AppColors>()!;
}
