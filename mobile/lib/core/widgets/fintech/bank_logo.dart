import 'package:flutter/material.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_radii.dart';
import '../../theme/app_typography.dart';

/// # BankLogo
///
/// Displays a bank's logo from the local asset pack.
/// Falls back to a colored circle with the bank's initials if the asset
/// is missing (e.g. during development or if a new bank is added before
/// the asset pack is updated).
///
/// ## Asset convention
/// All bank logos live in `assets/banks/` as PNG files.
/// File naming: lowercase bank code — `cbe.png`, `telebirr.png`, etc.
///
/// ## Supported bank codes
/// CBE, TELEBIRR, AWASH, DASHEN, ABYSSINIA, MPESA, ZEMEN
///
/// ## Example
/// ```dart
/// BankLogo(bankCode: 'CBE', size: 40)
/// BankLogo(bankCode: 'TELEBIRR', size: 32)
/// BankLogo(bankCode: 'UNKNOWN')  // → fallback initials
/// ```
class BankLogo extends StatelessWidget {
  const BankLogo({
    super.key,
    required this.bankCode,
    this.size = 40.0,
  });

  final String bankCode;
  final double size;

  static const _knownBanks = {
    'CBE',
    'TELEBIRR',
    'AWASH',
    'DASHEN',
    'ABYSSINIA',
    'MPESA',
    'ZEMEN',
  };

  String get _assetPath =>
      'assets/banks/${bankCode.toLowerCase()}.png';

  bool get _isKnown => _knownBanks.contains(bankCode.toUpperCase());

  @override
  Widget build(BuildContext context) {
    if (!_isKnown) {
      return _FallbackLogo(bankCode: bankCode, size: size);
    }

    return ClipRRect(
      borderRadius: AppRadii.radiusSm,
      child: Image.asset(
        _assetPath,
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) =>
            _FallbackLogo(bankCode: bankCode, size: size),
      ),
    );
  }
}

/// Fallback: initials inside a colored circle.
class _FallbackLogo extends StatelessWidget {
  const _FallbackLogo({required this.bankCode, required this.size});
  final String bankCode;
  final double size;

  /// Deterministic color from bank code string.
  Color _color(BuildContext context) {
    final colors = context.colors;
    // Simple hash for a consistent but distinct color per bank.
    final hash = bankCode.codeUnits.fold(0, (prev, e) => prev + e);
    final palette = [
      colors.primaryAction,
      colors.info,
      colors.warning,
      colors.success,
    ];
    return palette[hash % palette.length];
  }

  String get _initials {
    final upper = bankCode.toUpperCase();
    return upper.length >= 2 ? upper.substring(0, 2) : upper;
  }

  @override
  Widget build(BuildContext context) {
    final bg = _color(context);
    final fontSize = size * 0.35;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bg.withValues(alpha: 0.15),
        borderRadius: AppRadii.radiusSm,
        border: Border.all(color: bg.withValues(alpha: 0.3)),
      ),
      alignment: Alignment.center,
      child: Text(
        _initials,
        style: AppTypography.labelSmall.copyWith(
          fontSize: fontSize,
          color: bg,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
