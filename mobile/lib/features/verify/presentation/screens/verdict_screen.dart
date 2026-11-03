// Verdict screen (Step 22B Part 2).
//
// The receipt has already been read by the backend; this screen's job is to
// say what happened, prove it with the transaction facts, and offer exactly
// one next step. It re-reads the verification by id so a deep link and a
// fresh submission render the same thing.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/feedback/app_snackbar.dart';
import '../../../../core/widgets/layout/app_error_state.dart';
import '../../data/models/verification_result.dart';
import '../providers/verdict_screen_provider.dart';
import '../widgets/duplicate_reference_card.dart';
import '../widgets/needs_supplementary_card.dart';
import '../widgets/receipt_preview_sheet.dart';
import '../widgets/report_problem_sheet.dart';
import '../widgets/verdict_actions.dart';
import '../widgets/verdict_details_card.dart';
import '../widgets/verdict_hero.dart';

class VerdictScreen extends ConsumerWidget {
  const VerdictScreen({super.key, required this.verificationId});

  final String verificationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final provider = verdictScreenProvider(verificationId);
    final verdict = ref.watch(provider);

    return Scaffold(
      backgroundColor: colors.background,
      // No title: the hero is the title, and the 56 px it frees belongs to
      // the verdict. The back button is all this bar is for.
      appBar: AppBar(),
      body: SafeArea(
        child: verdict.when(
          loading: () => Center(
            child: CircularProgressIndicator(color: colors.primaryAction),
          ),
          error: (error, _) => Center(
            child: Padding(
              padding: AppSpacing.screenH,
              child: AppErrorState(
                message: error is ApiError
                    ? error.userFacingMessage(l10n)
                    : l10n.genericError,
                compact: true,
                onRetry: () => ref.invalidate(provider),
                retryLabel: l10n.retryLabel,
              ),
            ),
          ),
          data: (result) => _VerdictBody(result: result),
        ),
      ),
    );
  }
}

class _VerdictBody extends ConsumerWidget {
  const _VerdictBody({required this.result});

  final VerificationResult result;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final duplicate = result.duplicateOf;
    final receiptId = result.receiptId;

    Future<void> report() async {
      final submitted = await ReportProblemSheet.show(
        context,
        verificationId: result.id,
      );
      if (!context.mounted || submitted != true) return;
      AppSnackbar.show(
        context,
        message: l10n.verdictReportSubmitted,
        variant: AppSnackbarVariant.success,
      );
      ref.invalidate(verdictScreenProvider(result.id));
    }

    void viewOriginal() {
      if (duplicate == null) return;
      DuplicateDetailsSheet.show(context, duplicate);
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.xl,
        AppSpacing.lg,
        AppSpacing.xxxl,
      ),
      children: [
        VerdictHero(result: result),
        if (result.status == VerificationStatus.duplicate &&
            duplicate != null) ...[
          const SizedBox(height: AppSpacing.lg),
          DuplicateReferenceCard(
            result: result,
            onViewOriginal: viewOriginal,
          ),
        ],
        if (result.status == VerificationStatus.needsReview) ...[
          const SizedBox(height: AppSpacing.lg),
          NeedsSupplementaryCard(prompt: result.needsSupplementary),
        ],
        const SizedBox(height: AppSpacing.lg),
        VerdictDetailsCard(
          result: result,
          onViewReceipt: receiptId == null
              ? null
              : () => ReceiptPreviewSheet.show(context, receiptId: receiptId),
        ),
        if (result.status == VerificationStatus.needsReview) ...[
          const SizedBox(height: AppSpacing.md),
          _InfoLine(text: l10n.verdictReviewNotificationInfo),
        ],
        const SizedBox(height: AppSpacing.xxl),
        VerdictActions(
          status: result.status,
          onDone: () => context.go(Routes.verify),
          onTryAgain: () => context.go(Routes.verify),
          onReport: report,
          onViewOriginal: duplicate == null ? null : viewOriginal,
        ),
      ],
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.notifications_none_rounded,
            size: 16, color: colors.textSecondary),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            text,
            style:
                AppTypography.bodySmall.copyWith(color: colors.textSecondary),
          ),
        ),
      ],
    );
  }
}
