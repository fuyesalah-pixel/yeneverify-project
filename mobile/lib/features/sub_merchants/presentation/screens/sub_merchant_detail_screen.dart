// Step 24 — one team member: activity summary, branch label, removal.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/feedback/app_dialog.dart';
import '../../../../core/widgets/feedback/app_snackbar.dart';
import '../../../../core/widgets/inputs/app_text_field.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../../../core/widgets/layout/app_error_state.dart';
import '../../data/models/sub_merchant_detail.dart';
import '../providers/sub_merchants_provider.dart';

class SubMerchantDetailScreen extends ConsumerWidget {
  const SubMerchantDetailScreen({super.key, required this.subMerchantId});

  final String subMerchantId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final async = ref.watch(subMerchantDetailProvider(subMerchantId));

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(
          async.valueOrNull?.name.isNotEmpty == true
              ? async.valueOrNull!.name
              : l10n.teamDetailTitle,
        ),
        actions: [
          if (async.valueOrNull != null && !async.valueOrNull!.isInvite)
            IconButton(
              tooltip: l10n.teamChangeBranch,
              icon: const Icon(Icons.edit_outlined),
              onPressed: () => _editBranch(context, ref, async.valueOrNull!),
            ),
        ],
      ),
      body: async.when(
        skipLoadingOnRefresh: true,
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => AppErrorState(
          message: error is ApiError
              ? error.userFacingMessage(l10n)
              : l10n.dashboardErrorBody,
          onRetry: () =>
              ref.invalidate(subMerchantDetailProvider(subMerchantId)),
          retryLabel: l10n.retryLabel,
        ),
        data: (detail) {
          if (detail == null) {
            return AppErrorState(
              message: l10n.teamUnknown,
              onRetry: () =>
                  ref.invalidate(subMerchantDetailProvider(subMerchantId)),
              retryLabel: l10n.retryLabel,
            );
          }
          return _DetailBody(detail: detail);
        },
      ),
    );
  }

  Future<void> _editBranch(
    BuildContext context,
    WidgetRef ref,
    SubMerchantDetail detail,
  ) async {
    final l10n = AppLocalizations.of(context);
    final controller = TextEditingController(text: detail.branchLabel ?? '');
    final value = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.teamBranchLabel),
        content: AppTextField(
          controller: controller,
          autofocus: true,
          maxLength: 50,
          hint: l10n.teamBranchHint,
          textCapitalization: TextCapitalization.words,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.teamCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: Text(l10n.teamSave),
          ),
        ],
      ),
    );
    if (value == null || !context.mounted) return;

    final error = await ref
        .read(subMerchantsProvider.notifier)
        .updateBranch(detail.id, value.isEmpty ? null : value);
    ref.invalidate(subMerchantDetailProvider(detail.id));
    if (!context.mounted) return;
    AppSnackbar.show(
      context,
      message: error == null ? l10n.teamBranchSaved : l10n.genericError,
      variant: error == null ? AppSnackbarVariant.success : AppSnackbarVariant.error,
    );
  }
}

class _DetailBody extends ConsumerWidget {
  const _DetailBody({required this.detail});

  final SubMerchantDetail detail;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return ListView(
      padding: AppSpacing.screen,
      children: [
        AppCard(
          child: Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: colors.primaryAction.withValues(alpha: 0.12),
                child: Text(
                  detail.summary.initials,
                  style: AppTypography.labelLarge.copyWith(
                    color: colors.primaryAction,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      detail.name.isEmpty ? detail.phone : detail.name,
                      style: AppTypography.headingSmall.copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.micro),
                    Text(
                      detail.branchLabel ?? l10n.teamNoBranch,
                      style: AppTypography.bodySmall.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                detail.isInvite
                    ? l10n.teamNotJoined
                    : l10n.teamActivity(detail.verificationCount),
                style: AppTypography.bodyMedium.copyWith(
                  color: colors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              _InfoRow(label: l10n.teamPhoneLabel, value: detail.phone),
              const SizedBox(height: AppSpacing.sm),
              _InfoRow(
                label: l10n.teamBranchLabel,
                value: detail.branchLabel ?? l10n.teamNoBranch,
              ),
              if (detail.summary.joinedAt != null) ...[
                const SizedBox(height: AppSpacing.sm),
                _InfoRow(
                  label: l10n.teamJoinedLabel,
                  value: _date(detail.summary.joinedAt!),
                ),
              ],
              if (detail.lastVerificationAt != null) ...[
                const SizedBox(height: AppSpacing.sm),
                _InfoRow(
                  label: l10n.teamLastActiveLabel,
                  value: _date(detail.lastVerificationAt!),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        AppButton(
          label: detail.isInvite ? l10n.teamResend : l10n.teamChangeBranch,
          variant: AppButtonVariant.secondary,
          icon: detail.isInvite
              ? Icons.send_outlined
              : Icons.edit_outlined,
          onPressed: () async {
            if (detail.isInvite) {
              final error = await ref
                  .read(subMerchantsProvider.notifier)
                  .resendInvite(detail.id);
              if (!context.mounted) return;
              AppSnackbar.show(
                context,
                message:
                    error == null ? l10n.teamResendSuccess : l10n.teamResendFailed,
                variant: error == null
                    ? AppSnackbarVariant.success
                    : AppSnackbarVariant.error,
              );
            } else {
              // Reuse the app-bar editor.
              final container = ProviderScope.containerOf(context);
              await _editBranchFromButton(context, container, detail);
            }
          },
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: l10n.teamRemove,
          variant: AppButtonVariant.danger,
          onPressed: () => _remove(context, ref),
        ),
      ],
    );
  }

  Future<void> _editBranchFromButton(
    BuildContext context,
    ProviderContainer container,
    SubMerchantDetail detail,
  ) async {
    final l10n = AppLocalizations.of(context);
    final controller = TextEditingController(text: detail.branchLabel ?? '');
    final value = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.teamBranchLabel),
        content: AppTextField(controller: controller, autofocus: true, maxLength: 50),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.teamCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: Text(l10n.teamSave),
          ),
        ],
      ),
    );
    if (value == null) return;

    final error = await container
        .read(subMerchantsProvider.notifier)
        .updateBranch(detail.id, value.isEmpty ? null : value);
    container.invalidate(subMerchantDetailProvider(detail.id));
    if (!context.mounted) return;
    AppSnackbar.show(
      context,
      message: error == null ? l10n.teamBranchSaved : l10n.genericError,
      variant: error == null ? AppSnackbarVariant.success : AppSnackbarVariant.error,
    );
  }

  Future<void> _remove(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await AppDialog.confirm(
      context,
      title: detail.name.isEmpty
          ? l10n.teamRemoveConfirmTitle(detail.phone)
          : l10n.teamRemoveConfirmTitle(detail.name),
      body: l10n.teamRemoveConfirmBody,
      confirmLabel: l10n.teamRemove,
      cancelLabel: l10n.teamCancel,
      isDanger: true,
    );
    if (confirmed != true || !context.mounted) return;

    final error = await ref.read(subMerchantsProvider.notifier).remove(detail.id);
    if (!context.mounted) return;
    if (error == null && context.mounted) {
      AppSnackbar.show(
        context,
        message: l10n.teamRemoveSuccess,
        variant: AppSnackbarVariant.success,
      );
      // Navigator (not go_router) so the screen also works when embedded in
      // a plain test/route context.
      if (Navigator.of(context).canPop()) Navigator.of(context).pop();
    } else {
      AppSnackbar.show(
        context,
        message: l10n.teamRemoveFailed,
        variant: AppSnackbarVariant.error,
      );
    }
  }

  String _date(DateTime value) {
    final local = value.toLocal();
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-'
        '${local.day.toString().padLeft(2, '0')}';
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppTypography.bodySmall.copyWith(color: colors.textSecondary),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: AppTypography.bodyMedium.copyWith(color: colors.textPrimary),
          ),
        ),
      ],
    );
  }
}
