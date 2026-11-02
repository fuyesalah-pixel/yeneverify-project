import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_colors.dart';
import 'app_radii.dart';
import 'app_typography.dart';

/// # AppTheme — Light & Dark ThemeData
///
/// Builds complete [ThemeData] for both modes.
/// All colors come from [AppColors.light] / [AppColors.dark].
/// All type styles come from [AppTypography].
/// All radii come from [AppRadii].
///
/// ## Usage in app.dart
/// ```dart
/// MaterialApp(
///   theme: AppTheme.lightTheme(),
///   darkTheme: AppTheme.darkTheme(),
///   themeMode: ThemeMode.system,
/// )
/// ```
abstract final class AppTheme {
  // ─── Public factories ────────────────────────────────────────────────────

  /// Returns the Yene Verify light [ThemeData].
  static ThemeData lightTheme() => _buildTheme(colors: AppColors.light, brightness: Brightness.light);

  /// Returns the Yene Verify dark [ThemeData].
  static ThemeData darkTheme() => _buildTheme(colors: AppColors.dark, brightness: Brightness.dark);

  // ─── Builder ─────────────────────────────────────────────────────────────

  static ThemeData _buildTheme({
    required AppColors colors,
    required Brightness brightness,
  }) {
    final isDark = brightness == Brightness.dark;

    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: colors.primaryAction,
      onPrimary: colors.onPrimary,
      primaryContainer: colors.primaryActionDisabled,
      onPrimaryContainer: colors.primaryAction,
      secondary: colors.brandAccent,
      onSecondary: colors.textPrimary,
      secondaryContainer: colors.surfaceAlt,
      onSecondaryContainer: colors.textPrimary,
      tertiary: colors.info,
      onTertiary: colors.onPrimary,
      tertiaryContainer: colors.surfaceAlt,
      onTertiaryContainer: colors.textPrimary,
      error: colors.error,
      onError: colors.onPrimary,
      errorContainer: colors.surfaceAlt,
      onErrorContainer: colors.error,
      surface: colors.surface,
      onSurface: colors.textPrimary,
      surfaceContainerHighest: colors.surfaceAlt,
      onSurfaceVariant: colors.textSecondary,
      outline: colors.border,
      outlineVariant: colors.divider,
      shadow: AppColors.dark.textPrimary,
      scrim: colors.overlay,
      inverseSurface: isDark ? colors.background : AppColors.dark.textPrimary,
      onInverseSurface: isDark ? AppColors.dark.textPrimary : AppColors.light.background,
      inversePrimary: isDark ? AppColors.light.primaryAction : AppColors.dark.primaryAction,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: colors.background,
      textTheme: AppTypography.textTheme.apply(
        bodyColor: colors.textPrimary,
        displayColor: colors.textPrimary,
      ),
      extensions: [colors],

      // ── AppBar ──────────────────────────────────────────────────────────
      appBarTheme: AppBarTheme(
        backgroundColor: colors.background,
        foregroundColor: colors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: AppTypography.headingMedium.copyWith(
          color: colors.textPrimary,
        ),
        systemOverlayStyle: isDark
            ? SystemUiOverlayStyle.light.copyWith(
                statusBarColor: AppColors.transparent,
              )
            : SystemUiOverlayStyle.dark.copyWith(
                statusBarColor: AppColors.transparent,
              ),
        iconTheme: IconThemeData(color: colors.textPrimary),
        actionsIconTheme: IconThemeData(color: colors.textPrimary),
      ),

      // ── Card ────────────────────────────────────────────────────────────
      cardTheme: CardThemeData(
        color: colors.surface,
        elevation: isDark ? 0 : 1,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.radiusLg,
          side: isDark ? BorderSide(color: colors.border) : BorderSide.none,
        ),
        margin: EdgeInsets.zero,
      ),

      // ── ElevatedButton ──────────────────────────────────────────────────
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: colors.primaryAction,
          foregroundColor: colors.onPrimary,
          disabledBackgroundColor: colors.primaryActionDisabled,
          disabledForegroundColor: colors.textDisabled,
          textStyle: AppTypography.labelLarge,
          shape: RoundedRectangleBorder(borderRadius: AppRadii.radiusMd),
          minimumSize: const Size(double.infinity, 52),
          elevation: 0,
        ),
      ),

      // ── OutlinedButton ──────────────────────────────────────────────────
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: colors.primaryAction,
          disabledForegroundColor: colors.textDisabled,
          side: BorderSide(color: colors.primaryAction),
          textStyle: AppTypography.labelLarge,
          shape: RoundedRectangleBorder(borderRadius: AppRadii.radiusMd),
          minimumSize: const Size(double.infinity, 52),
        ),
      ),

      // ── TextButton ──────────────────────────────────────────────────────
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: colors.primaryAction,
          textStyle: AppTypography.labelLarge,
          shape: RoundedRectangleBorder(borderRadius: AppRadii.radiusMd),
        ),
      ),

      // ── InputDecoration ─────────────────────────────────────────────────
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.surfaceAlt,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: AppRadii.radiusMd,
          borderSide: BorderSide(color: colors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadii.radiusMd,
          borderSide: BorderSide(color: colors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadii.radiusMd,
          borderSide: BorderSide(color: colors.primaryAction, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadii.radiusMd,
          borderSide: BorderSide(color: colors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadii.radiusMd,
          borderSide: BorderSide(color: colors.error, width: 1.5),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: AppRadii.radiusMd,
          borderSide: BorderSide(color: colors.border),
        ),
        hintStyle: AppTypography.bodyLarge.copyWith(color: colors.textDisabled),
        labelStyle: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
        errorStyle: AppTypography.bodySmall.copyWith(color: colors.error),
        prefixIconColor: colors.textSecondary,
        suffixIconColor: colors.textSecondary,
      ),

      // ── Chip ────────────────────────────────────────────────────────────
      chipTheme: ChipThemeData(
        backgroundColor: colors.surfaceAlt,
        selectedColor: colors.primaryAction.withValues(alpha: 0.15),
        labelStyle: AppTypography.labelMedium.copyWith(color: colors.textPrimary),
        shape: RoundedRectangleBorder(borderRadius: AppRadii.radiusSm),
        side: BorderSide(color: colors.border),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      ),

      // ── Dialog ──────────────────────────────────────────────────────────
      dialogTheme: DialogThemeData(
        backgroundColor: colors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: AppRadii.radiusLg),
        titleTextStyle: AppTypography.headingSmall.copyWith(color: colors.textPrimary),
        contentTextStyle: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
      ),

      // ── BottomSheet ─────────────────────────────────────────────────────
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: colors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: AppRadii.sheetTop),
        showDragHandle: true,
        dragHandleColor: colors.border,
      ),

      // ── BottomNavigationBar ─────────────────────────────────────────────
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: colors.surface,
        selectedItemColor: colors.primaryAction,
        unselectedItemColor: colors.textSecondary,
        showSelectedLabels: true,
        showUnselectedLabels: true,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: AppTypography.labelSmall,
        unselectedLabelStyle: AppTypography.labelSmall,
        elevation: 0,
      ),

      // ── Snackbar ────────────────────────────────────────────────────────
      snackBarTheme: SnackBarThemeData(
        backgroundColor: colors.snackbarBackground,
        contentTextStyle: AppTypography.bodyMedium.copyWith(
          color: AppColors.dark.textPrimary,
        ),
        shape: RoundedRectangleBorder(borderRadius: AppRadii.radiusMd),
        behavior: SnackBarBehavior.floating,
        elevation: 0,
      ),

      // ── Divider ─────────────────────────────────────────────────────────
      dividerTheme: DividerThemeData(
        color: colors.divider,
        thickness: 1,
        space: 1,
      ),

      // ── Switch ──────────────────────────────────────────────────────────
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return colors.primaryAction;
          return colors.textDisabled;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return colors.primaryAction.withValues(alpha: 0.3);
          }
          return colors.surfaceAlt;
        }),
      ),

      // ── ListTile ────────────────────────────────────────────────────────
      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        titleTextStyle: AppTypography.bodyLarge.copyWith(color: colors.textPrimary),
        subtitleTextStyle: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
        iconColor: colors.textSecondary,
      ),

      // ── Icon ────────────────────────────────────────────────────────────
      iconTheme: IconThemeData(color: colors.textPrimary, size: 24),
    );
  }
}
