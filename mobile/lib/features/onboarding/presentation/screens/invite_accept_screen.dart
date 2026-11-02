// Sub-merchant invite accept/decline (Step 22A).
//
// The token is not exposed by /onboarding/status, so the user pastes the code
// from the SMS. Deep links are backlog.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/feedback/app_dialog.dart';
import '../../../../core/widgets/feedback/app_snackbar.dart';
import '../../../../core/widgets/inputs/app_text_field.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../../auth/domain/auth_notifier.dart';
import '../providers/invite_provider.dart';

class InviteAcceptScreen extends ConsumerWidget {
  const InviteAcceptScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final auth = ref.watch(authProvider).valueOrNull;
    final invite = auth?.pendingInvite;
    final merchantName = invite?.merchantName ?? '';
    final state = ref.watch(inviteProvider).valueOrNull ?? const InviteState();
    final canSubmit = state.inviteToken.trim().isNotEmpty && !state.isBusy;

    return Scaffold(
      appBar: AppBar(automaticallyImplyLeading: false),
      backgroundColor: colors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.xxxl,
            AppSpacing.lg,
            AppSpacing.xxl,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(Icons.group_outlined, size: 64, color: colors.primaryAction),
              const SizedBox(height: AppSpacing.lg),
              Text(
                l10n.inviteTitle,
                style: AppTypography.displayMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.inviteBody(merchantName),
                      style: AppTypography.bodyMedium,
                    ),
                    if (invite?.branchLabel != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        l10n.inviteBranch(invite!.branchLabel!),
                        style: AppTypography.bodySmall.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      l10n.inviteAbility,
                      style: AppTypography.bodySmall.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xxxl),
              AppTextField(
                label: l10n.inviteCodeLabel,
                hint: l10n.inviteCodeHint,
                textInputAction: TextInputAction.done,
                errorText: state.error == null
                    ? null
                    : _errorMessage(l10n, state.error!, merchantName),
                onChanged: ref.read(inviteProvider.notifier).updateToken,
              ),
              const SizedBox(height: AppSpacing.xxxl),
              AppButton(
                label: l10n.acceptInvite,
                isLoading: state.isAccepting,
                onPressed: canSubmit
                    ? () => _accept(context, ref, merchantName)
                    : null,
              ),
              const SizedBox(height: AppSpacing.lg),
              AppButton(
                label: l10n.declineInvite,
                variant: AppButtonVariant.ghost,
                isLoading: state.isDeclining,
                onPressed: state.isBusy
                    ? null
                    : () => _decline(context, ref, merchantName),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _accept(
    BuildContext context,
    WidgetRef ref,
    String merchantName,
  ) async {
    final error = await ref.read(inviteProvider.notifier).accept();
    if (!context.mounted) return;

    if (error == null) {
      context.go(Routes.dashboard);
    } else if (error.isNetwork || error.isTimeout) {
      _showNetworkError(context, ref);
    }
  }

  Future<void> _decline(
    BuildContext context,
    WidgetRef ref,
    String merchantName,
  ) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await AppDialog.confirm(
      context,
      title: l10n.declineInviteConfirmTitle,
      body: l10n.declineInviteConfirmBody(merchantName),
      confirmLabel: l10n.declineInvite,
      cancelLabel: l10n.cancelLabel,
      isDanger: true,
    );
    if (confirmed != true || !context.mounted) return;

    final error = await ref.read(inviteProvider.notifier).decline();
    if (!context.mounted) return;

    if (error == null) {
      // The repository refreshed status. A MERCHANT account now reports
      // MERCHANT_PROFILE, so OnboardingFlowScreen swaps to the setup form.
      final needsOnboarding =
          ref.read(authProvider).valueOrNull?.needsOnboarding ?? true;
      if (!needsOnboarding) context.go(Routes.dashboard);
    } else if (error.isNetwork || error.isTimeout) {
      _showNetworkError(context, ref);
    }
  }

  void _showNetworkError(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    AppSnackbar.show(
      context,
      message: l10n.networkError,
      variant: AppSnackbarVariant.error,
    );
  }

  String _errorMessage(
    AppLocalizations l10n,
    ApiError error,
    String merchantName,
  ) {
    return switch (error.code) {
      'AUTH_INVITE_EXPIRED' => l10n.inviteExpired(merchantName),
      'AUTH_INVITE_CONSUMED' => l10n.inviteConsumed,
      'AUTH_INVITE_INVALID' => l10n.inviteInvalid,
      _ => error.userFacingMessage(l10n),
    };
  }
}
