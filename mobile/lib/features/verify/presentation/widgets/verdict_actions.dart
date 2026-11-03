// Actions are chosen by status: one primary, at most two supporting.
//
// VERIFIED      Done
// FAKE          Report a problem · Try again · Done
// DUPLICATE     View original · Report a problem · Done
// NEEDS_REVIEW  Done
// ERROR         Try again · Report a problem · Done
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../data/models/verification_result.dart';

class VerdictActions extends StatelessWidget {
  const VerdictActions({
    super.key,
    required this.status,
    required this.onDone,
    required this.onTryAgain,
    required this.onReport,
    this.onViewOriginal,
  });

  final VerificationStatus status;
  final VoidCallback onDone;
  final VoidCallback onTryAgain;
  final VoidCallback onReport;
  final VoidCallback? onViewOriginal;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        switch (status) {
          VerificationStatus.fake => AppButton(
              label: l10n.verdictReportButton,
              icon: Icons.flag_outlined,
              onPressed: onReport,
            ),
          VerificationStatus.duplicate => AppButton(
              label: l10n.verdictViewOriginalButton,
              icon: Icons.receipt_long_outlined,
              onPressed: onViewOriginal,
            ),
          VerificationStatus.error => AppButton(
              label: l10n.verdictTryAgainButton,
              onPressed: onTryAgain,
            ),
          _ => AppButton(
              label: l10n.verdictDoneButton,
              onPressed: onDone,
            ),
        },
        if (_hasSupportingActions) ..._supporting(context, l10n),
      ],
    );
  }

  bool get _hasSupportingActions =>
      status == VerificationStatus.fake ||
      status == VerificationStatus.duplicate ||
      status == VerificationStatus.error;

  List<Widget> _supporting(BuildContext context, AppLocalizations l10n) {
    return [
      const SizedBox(height: AppSpacing.sm),
      if (status == VerificationStatus.fake)
        AppButton(
          label: l10n.verdictTryAgainButton,
          variant: AppButtonVariant.secondary,
          onPressed: onTryAgain,
        ),
      if (status == VerificationStatus.duplicate || status == VerificationStatus.error)
        AppButton(
          label: l10n.verdictReportButton,
          variant: AppButtonVariant.secondary,
          onPressed: onReport,
        ),
      const SizedBox(height: AppSpacing.xs),
      AppButton(
        label: l10n.verdictDoneButton,
        variant: AppButtonVariant.ghost,
        onPressed: onDone,
      ),
    ];
  }
}
