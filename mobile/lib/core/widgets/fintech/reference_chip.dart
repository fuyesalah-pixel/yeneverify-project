import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_radii.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// # ReferenceChip
///
/// Displays a bank transaction reference number in monospace with a
/// copy-to-clipboard button.
///
/// ## Design rules
/// - Always uses [AppTypography.mono] (tabular, spaced).
/// - Background is [AppColors.surfaceAlt] — distinct from card surface.
/// - Copy icon triggers a brief "Copied!" tooltip.
///
/// ## When to use
/// - Verification result screen (transaction reference).
/// - Transaction detail screen (reference row).
/// - Billing verification detail.
///
/// ## Example
/// ```dart
/// ReferenceChip(reference: 'FT24305983477')
/// ReferenceChip(reference: 'DEV1234567890', label: 'Telebirr Ref')
/// ```
class ReferenceChip extends StatefulWidget {
  const ReferenceChip({
    super.key,
    required this.reference,
    this.label,
  });

  final String reference;

  /// Optional label above the chip (e.g. "Transaction Reference").
  final String? label;

  @override
  State<ReferenceChip> createState() => _ReferenceChipState();
}

class _ReferenceChipState extends State<ReferenceChip> {
  bool _copied = false;

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.reference));
    if (!mounted) return;
    setState(() => _copied = true);
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;
    setState(() => _copied = false);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.label != null) ...[
          Text(
            widget.label!,
            style: AppTypography.bodySmall.copyWith(
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
        ],
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: colors.surfaceAlt,
            borderRadius: AppRadii.radiusMd,
            border: Border.all(color: colors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  widget.reference,
                  style: AppTypography.mono.copyWith(
                    color: colors.textPrimary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              GestureDetector(
                onTap: _copy,
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.xs),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    child: _copied
                        ? Icon(
                            Icons.check_rounded,
                            key: const ValueKey('check'),
                            size: 16,
                            color: colors.success,
                          )
                        : Icon(
                            Icons.copy_rounded,
                            key: const ValueKey('copy'),
                            size: 16,
                            color: colors.textSecondary,
                          ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
