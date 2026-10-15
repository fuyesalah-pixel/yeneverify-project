import 'package:flutter/material.dart';

/// # AppShadows — Elevation & Shadow Tokens
///
/// Light mode uses drop shadows for elevation.
/// Dark mode replaces shadows with a 1px border (see [AppColors.border]).
/// Never hardcode BoxShadow values in widgets.
///
/// ## Usage
/// ```dart
/// BoxDecoration(
///   boxShadow: AppShadows.elevation1,
/// )
/// ```
abstract final class AppShadows {
  // ─── Light mode shadows ───────────────────────────────────────────────────

  /// Subtle card shadow — default for [AppCard].
  static const List<BoxShadow> elevation1 = [
    BoxShadow(
      color: Color(0x0A000000), // rgba(0,0,0,0.04)
      blurRadius: 2,
      offset: Offset(0, 1),
    ),
    BoxShadow(
      color: Color(0x0F000000), // rgba(0,0,0,0.06)
      blurRadius: 3,
      offset: Offset(0, 1),
    ),
  ];

  /// Medium shadow — floating action buttons, bottom sheets.
  static const List<BoxShadow> elevation2 = [
    BoxShadow(
      color: Color(0x0F000000), // rgba(0,0,0,0.06)
      blurRadius: 8,
      offset: Offset(0, 4),
    ),
    BoxShadow(
      color: Color(0x0A000000), // rgba(0,0,0,0.04)
      blurRadius: 4,
      offset: Offset(0, 2),
    ),
  ];

  /// Strong shadow — modals, dialogs.
  static const List<BoxShadow> elevation3 = [
    BoxShadow(
      color: Color(0x1A000000), // rgba(0,0,0,0.10)
      blurRadius: 24,
      offset: Offset(0, 12),
    ),
    BoxShadow(
      color: Color(0x0F000000), // rgba(0,0,0,0.06)
      blurRadius: 8,
      offset: Offset(0, 4),
    ),
  ];

  // ─── Dark mode ────────────────────────────────────────────────────────────

  /// In dark mode, use a 1px border instead of shadows.
  /// Pass the theme's [AppColors.border] color to the widget.
  static const List<BoxShadow> none = [];
}
