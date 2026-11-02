import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/business_types.dart';

/// Single-select chip row for [BusinessType]. Tapping the selected chip
/// clears the selection (the whole section is optional).
class BusinessTypePicker extends StatelessWidget {
  const BusinessTypePicker({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final BusinessType? selected;
  final ValueChanged<BusinessType?> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    String labelFor(BusinessType type) => switch (type) {
          BusinessType.cafe => l10n.businessTypeCafe,
          BusinessType.restaurant => l10n.businessTypeRestaurant,
          BusinessType.retail => l10n.businessTypeRetail,
          BusinessType.services => l10n.businessTypeServices,
          BusinessType.other => l10n.businessTypeOther,
        };

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        for (final type in BusinessType.values)
          ChoiceChip(
            avatar: Icon(
              type.icon,
              size: 18,
              color: selected == type
                  ? colors.primaryAction
                  : colors.textSecondary,
            ),
            label: Text(labelFor(type), style: AppTypography.labelMedium),
            selected: selected == type,
            selectedColor: colors.primaryAction.withValues(alpha: 0.15),
            onSelected: (_) => onSelected(selected == type ? null : type),
          ),
      ],
    );
  }
}
