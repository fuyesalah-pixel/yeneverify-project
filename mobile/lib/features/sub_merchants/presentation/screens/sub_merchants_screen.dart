// Step 24 — Team list: active members, pending invites, seat cap warning.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/feedback/app_dialog.dart';
import '../../../../core/widgets/feedback/app_snackbar.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../../../core/widgets/layout/app_empty_state.dart';
import '../../../../core/widgets/layout/app_error_state.dart';
import '../../../../core/widgets/layout/section_header.dart';
import '../../data/models/sub_merchant_summary.dart';
import '../providers/sub_merchants_provider.dart';
import '../widgets/invite_row.dart';
import '../widgets/plan_cap_warning.dart';
import '../widgets/sub_merchant_row.dart';

class SubMerchantsScreen extends ConsumerWidget {
  const SubMerchantsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final async = ref.watch(subMerchantsProvider);

    void openInvite() => context.push(Routes.subMerchantInvite);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(l10n.subMerchantsTitle),
        actions: [
          IconButton(
            tooltip: l10n.addSubMerchant,
            icon: const Icon(Icons.add_rounded),
            onPressed: openInvite,
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
          onRetry: () => ref.invalidate(subMerchantsProvider),
          retryLabel: l10n.retryLabel,
        ),
        data: (state) => RefreshIndicator(
          color: colors.primaryAction,
          onRefresh: () async {
            try {
              await ref.read(subMerchantsProvider.notifier).refresh();
            } catch (_) {
              // The error state renders from the provider.
            }
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
            children: [
              PlanCapWarning(
                cap: state.cap,
                onUpgrade: () => context.push(Routes.billing),
              ),
              if (state.isEmpty)
                AppEmptyState(
                  icon: Icons.groups_2_outlined,
                  title: l10n.noSubMerchantsTitle,
                  body: l10n.noSubMerchantsBody,
                  actionLabel: l10n.addSubMerchant,
                  onAction: openInvite,
                )
              else ...[
                if (state.members.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Padding(
                    padding: AppSpacing.screenH,
                    child: SectionHeader(title: l10n.teamActiveSection),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  _MemberList(items: state.members),
                ],
                if (state.invites.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xl),
                  Padding(
                    padding: AppSpacing.screenH,
                    child: SectionHeader(title: l10n.teamPendingSection),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  _InviteList(items: state.invites),
                ],
              ],
            ],
          ),
        ),
      ),
      bottomNavigationBar: async.hasValue
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.sm,
                  AppSpacing.lg,
                  AppSpacing.md,
                ),
                child: AppButton(
                  label: l10n.addSubMerchant,
                  icon: Icons.person_add_alt_1_rounded,
                  onPressed: openInvite,
                ),
              ),
            )
          : null,
    );
  }
}

class _MemberList extends StatelessWidget {
  const _MemberList({required this.items});

  final List<SubMerchantSummary> items;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: AppSpacing.screenH,
      child: AppCard(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Column(
          children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) Divider(height: 1, color: context.colors.divider),
              SubMerchantRow(
                item: items[i],
                onTap: () => context.push(Routes.subMerchantFor(items[i].id)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _InviteList extends ConsumerStatefulWidget {
  const _InviteList({required this.items});

  final List<SubMerchantSummary> items;

  @override
  ConsumerState<_InviteList> createState() => _InviteListState();
}

class _InviteListState extends ConsumerState<_InviteList> {
  String? _busyId;

  Future<void> _resend(SubMerchantSummary invite) async {
    final l10n = AppLocalizations.of(context);
    setState(() => _busyId = invite.id);
    final error = await ref
        .read(subMerchantsProvider.notifier)
        .resendInvite(invite.id);
    if (!mounted) return;
    setState(() => _busyId = null);
    AppSnackbar.show(
      context,
      message: error == null ? l10n.teamResendSuccess : l10n.teamResendFailed,
      variant: error == null ? AppSnackbarVariant.success : AppSnackbarVariant.error,
    );
  }

  Future<void> _revoke(SubMerchantSummary invite) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await AppDialog.confirm(
      context,
      title: l10n.teamRevokeConfirmTitle,
      body: l10n.teamRevokeConfirmBody,
      confirmLabel: l10n.teamRevoke,
      cancelLabel: l10n.teamCancel,
      isDanger: true,
    );
    if (confirmed != true || !mounted) return;

    setState(() => _busyId = invite.id);
    final error = await ref.read(subMerchantsProvider.notifier).remove(invite.id);
    if (!mounted) return;
    setState(() => _busyId = null);
    AppSnackbar.show(
      context,
      message: error == null ? l10n.teamRemoveSuccess : l10n.teamRemoveFailed,
      variant: error == null ? AppSnackbarVariant.success : AppSnackbarVariant.error,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: AppSpacing.screenH,
      child: AppCard(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Column(
          children: [
            for (var i = 0; i < widget.items.length; i++) ...[
              if (i > 0) Divider(height: 1, color: context.colors.divider),
              InviteRow(
                invite: widget.items[i],
                isBusy: _busyId == widget.items[i].id,
                onResend: () => _resend(widget.items[i]),
                onRevoke: () => _revoke(widget.items[i]),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
