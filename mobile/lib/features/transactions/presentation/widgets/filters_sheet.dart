// Bank multi-select + date presets in one sheet: two filters, one Apply.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/fintech/bank_logo.dart';
import '../../domain/transactions_query.dart';

class FiltersResult {
  const FiltersResult({required this.banks, required this.range});

  final Set<String> banks;
  final TransactionsRange range;
}

class FiltersSheet extends StatefulWidget {
  const FiltersSheet({
    super.key,
    required this.banks,
    required this.range,
  });

  final Set<String> banks;
  final TransactionsRange range;

  static Future<FiltersResult?> show(
    BuildContext context, {
    required Set<String> banks,
    required TransactionsRange range,
  }) {
    return showModalBottomSheet<FiltersResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.lg)),
      ),
      builder: (_) => FiltersSheet(banks: banks, range: range),
    );
  }

  @override
  State<FiltersSheet> createState() => _FiltersSheetState();
}

class _FiltersSheetState extends State<FiltersSheet> {
  late Set<String> _banks = {...widget.banks};
  late TransactionsRange _range = widget.range;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    final bankOptions = <(String, String)>[
      ('CBE', l10n.bankCbe),
      ('TELEBIRR', l10n.bankTelebirr),
      ('AWASH', l10n.bankAwash),
      ('DASHEN', l10n.bankDashen),
      ('ABYSSINIA', l10n.bankAbyssinia),
      ('MPESA', l10n.bankMpesa),
      ('ZEMEN', l10n.bankZemen),
    ];

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                l10n.transactionsFilterTitle,
                style: AppTypography.headingSmall.copyWith(
                  color: colors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                l10n.transactionsFilterBank,
                style: AppTypography.labelMedium.copyWith(
                  color: colors.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              for (final (code, name) in bankOptions)
                CheckboxListTile(
                  value: _banks.contains(code),
                  onChanged: (checked) => setState(() {
                    if (checked ?? false) {
                      _banks.add(code);
                    } else {
                      _banks.remove(code);
                    }
                  }),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.trailing,
                  secondary: BankLogo(bankCode: code, size: 28),
                  title: Text(
                    name,
                    style: AppTypography.bodyMedium.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                ),
              const SizedBox(height: AppSpacing.md),
              Text(
                l10n.transactionsFilterRange,
                style: AppTypography.labelMedium.copyWith(
                  color: colors.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final range in TransactionsRange.values)
                    ChoiceChip(
                      label: Text(rangeLabel(l10n, range)),
                      selected: _range == range,
                      onSelected: (_) => setState(() => _range = range),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.xl),
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      label: l10n.transactionsClearAll,
                      variant: AppButtonVariant.ghost,
                      onPressed: () => setState(() {
                        _banks = {};
                        _range = TransactionsRange.d30;
                      }),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: AppButton(
                      label: l10n.transactionsApply,
                      onPressed: () => Navigator.of(context).pop(
                        FiltersResult(banks: _banks, range: _range),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String rangeLabel(AppLocalizations l10n, TransactionsRange range) {
  return switch (range) {
    TransactionsRange.d7 => l10n.dashboardRange7,
    TransactionsRange.d30 => l10n.dashboardRange30,
    TransactionsRange.d90 => l10n.dashboardRange90,
    TransactionsRange.thisYear => l10n.transactionsRangeYear,
    TransactionsRange.all => l10n.transactionsRangeAll,
  };
}
