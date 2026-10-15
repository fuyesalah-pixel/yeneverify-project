import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_typography.dart';

/// # AmountText
///
/// Displays a monetary amount in ETB with consistent formatting.
///
/// ## Format
/// `5,500.00 ETB` — always 2 decimal places, thousands separator,
/// currency suffix (never prefix).
///
/// ## Variants
/// - [AmountTextSize.display] — large hero amount (result screen, balance).
/// - [AmountTextSize.heading] — card/section amount.
/// - [AmountTextSize.body]    — list row amount.
/// - [AmountTextSize.caption] — small supplementary amount.
///
/// ## Rules
/// - [amountMinor] is in integer minor units (santim). This widget divides
///   by 100 internally. Never pass a float.
/// - Uses tabular figures so digits don't shift width in lists.
/// - Color defaults to [AppColors.textPrimary]. Pass [color] to override
///   (e.g. use [AppColors.success] for a verified amount).
///
/// ## Example
/// ```dart
/// AmountText(amountMinor: 550000) // → "5,500.00 ETB"
/// AmountText(amountMinor: 199900, size: AmountTextSize.display)
/// AmountText(amountMinor: tx.amountMinor, color: context.colors.success)
/// ```
class AmountText extends StatelessWidget {
  const AmountText({
    super.key,
    required this.amountMinor,
    this.size = AmountTextSize.body,
    this.color,
    this.showSign = false,
  });

  /// Amount in integer minor units (santim). Divided by 100 for display.
  final int amountMinor;

  final AmountTextSize size;

  /// Override text color. Defaults to [AppColors.textPrimary].
  final Color? color;

  /// If true, prefix positive amounts with `+`.
  final bool showSign;

  static final _formatter = NumberFormat('#,##0.00', 'en_US');

  String get _formatted {
    final major = amountMinor / 100.0;
    final formatted = _formatter.format(major);
    final sign = showSign && amountMinor > 0 ? '+' : '';
    return '$sign$formatted ETB';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final textColor = color ?? colors.textPrimary;

    final style = switch (size) {
      AmountTextSize.display => AppTypography.displayMedium,
      AmountTextSize.heading => AppTypography.headingSmall,
      AmountTextSize.body    => AppTypography.bodyLarge,
      AmountTextSize.caption => AppTypography.bodySmall,
    };

    return Text(
      _formatted,
      style: style.copyWith(color: textColor),
    );
  }
}

/// Size presets for [AmountText].
enum AmountTextSize { display, heading, body, caption }
