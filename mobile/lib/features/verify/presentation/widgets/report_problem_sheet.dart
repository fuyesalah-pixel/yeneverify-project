// "Report a problem" — the merchant-facing entry point to request-review.
//
// The reason is required by the backend (min length 10, max 500), so the
// form validates before spending a round trip and surfaces the backend's
// message inline when it still fails.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/network/api_result.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/feedback/app_bottom_sheet.dart';
import '../../../../core/widgets/inputs/app_text_field.dart';
import '../../data/verify_repository.dart';

class ReportProblemSheet extends ConsumerStatefulWidget {
  const ReportProblemSheet({super.key, required this.verificationId});

  final String verificationId;

  /// Returns true when a report was submitted, false/null when dismissed.
  static Future<bool?> show(
    BuildContext context, {
    required String verificationId,
  }) {
    return AppBottomSheet.show<bool>(
      context,
      title: AppLocalizations.of(context).verdictReportTitle,
      child: ReportProblemSheet(verificationId: verificationId),
    );
  }

  @override
  ConsumerState<ReportProblemSheet> createState() => _ReportProblemSheetState();
}

class _ReportProblemSheetState extends ConsumerState<ReportProblemSheet> {
  final _formKey = GlobalKey<FormState>();
  final _controller = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    final result = await ref.read(verificationsApiProvider).requestReview(
          widget.verificationId,
          reason: _controller.text.trim(),
        );
    if (!mounted) return;

    switch (result) {
      case Success():
        Navigator.of(context).pop(true);
      case Failure(:final error):
        setState(() {
          _submitting = false;
          _error = error.userFacingMessage(l10n);
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.verdictReportBody,
              style: AppTypography.bodyMedium.copyWith(
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            AppTextField(
              controller: _controller,
              label: l10n.verdictReportReasonHint,
              hint: l10n.verdictReportReasonHint,
              maxLines: 4,
              maxLength: 500,
              textCapitalization: TextCapitalization.sentences,
              validator: (value) => (value ?? '').trim().isEmpty
                  ? l10n.verdictReportReasonRequired
                  : null,
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _error!,
                style: AppTypography.bodySmall.copyWith(color: colors.error),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: l10n.verdictReportSubmitButton,
              icon: Icons.send_rounded,
              isLoading: _submitting,
              onPressed: _submit,
            ),
            const SizedBox(height: AppSpacing.xs),
            AppButton(
              label: l10n.verdictCancelButton,
              variant: AppButtonVariant.ghost,
              onPressed: _submitting
                  ? null
                  : () => Navigator.of(context).pop(false),
            ),
          ],
        ),
      ),
    );
  }
}
