// Step 24 — the Profile tab: identity, team, plan, preferences, sign out.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/localization/locale_provider.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/theme_mode_provider.dart';
import '../../../../core/widgets/feedback/app_dialog.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../../../core/widgets/layout/app_list_tile.dart';
import '../../../auth/domain/auth_notifier.dart';
import '../../../sub_merchants/domain/plan_limits.dart';
import '../../../sub_merchants/presentation/providers/sub_merchants_provider.dart';
import '../providers/profile_providers.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final user = ref.watch(authProvider).valueOrNull?.user;
    final merchant = ref.watch(merchantMeProvider).valueOrNull;
    final subscription = ref.watch(subscriptionMeProvider).valueOrNull;
    final team = ref.watch(subMerchantsProvider).valueOrNull;
    final version = ref.watch(appVersionProvider).valueOrNull;

    final packageCode =
        subscription?.packageCode ?? merchant?.currentPackageCode ?? '';
    final planLabel = _planLabel(packageCode, l10n);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.profileTitle)),
      body: ListView(
        padding: AppSpacing.screen,
        children: [
          // ── Identity ─────────────────────────────────────────────────────
          AppCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: colors.primaryAction.withValues(alpha: 0.12),
                  child: Text(
                    _initials(user?.fullName ?? ''),
                    style: AppTypography.headingSmall.copyWith(
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
                        user?.fullName.isNotEmpty == true
                            ? user!.fullName
                            : l10n.teamUnknown,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.headingSmall.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.micro),
                      Text(
                        maskEthiopianPhone(user?.phone ?? ''),
                        style: AppTypography.bodySmall.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                      if (merchant?.businessName.isNotEmpty == true) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          l10n.profileBusiness(merchant!.businessName),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.bodySmall.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (planLabel.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.micro,
                    ),
                    decoration: BoxDecoration(
                      color: colors.primaryAction.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      planLabel,
                      style: AppTypography.labelSmall.copyWith(
                        color: colors.primaryAction,
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // ── Account ──────────────────────────────────────────────────────
          _Section(
            title: l10n.profileAccountSection,
            children: [
              AppListTile(
                leading: const Icon(Icons.storefront_outlined),
                title: l10n.profileEditBusiness,
                subtitle: l10n.profileComingSoon,
                enabled: false,
              ),
              AppListTile(
                leading: const Icon(Icons.pin_outlined),
                title: l10n.profileChangePin,
                subtitle: l10n.profileComingSoon,
                enabled: false,
              ),
            ],
          ),

          // ── Team ─────────────────────────────────────────────────────────
          _Section(
            title: l10n.profileTeamSection,
            children: [
              AppListTile(
                leading: const Icon(Icons.groups_2_outlined),
                title: l10n.profileManageTeam,
                subtitle: team == null
                    ? null
                    : l10n.profileTeamCount(
                        team.members.length,
                        team.invites.length,
                      ),
                trailing: const Icon(Icons.chevron_right_rounded, size: 20),
                onTap: () => context.push(Routes.subMerchants),
              ),
            ],
          ),

          // ── Subscription ─────────────────────────────────────────────────
          _Section(
            title: l10n.profileSubscriptionSection,
            children: [
              AppListTile(
                leading: const Icon(Icons.workspace_premium_outlined),
                title:
                    planLabel.isEmpty ? l10n.billingCurrentPlan : planLabel,
                subtitle: _planSubtitle(subscription?.daysRemaining, l10n, planLabel),
                enabled: false,
              ),
            ],
          ),

          // ── Preferences ──────────────────────────────────────────────────
          _Section(
            title: l10n.profilePreferencesSection,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.sm,
                  AppSpacing.lg,
                  AppSpacing.sm,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.language,
                      style: AppTypography.bodyMedium.copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    SegmentedButton<String>(
                      segments: [
                        ButtonSegment(
                          value: 'en',
                          label: Text(l10n.languageEnglish),
                        ),
                        ButtonSegment(
                          value: 'am',
                          label: Text(l10n.languageAmharic),
                        ),
                      ],
                      selected: {
                        Localizations.localeOf(context).languageCode == 'am'
                            ? 'am'
                            : 'en',
                      },
                      onSelectionChanged: (selection) {
                        ref.read(localeProvider.notifier).state =
                            Locale(selection.first);
                      },
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: colors.divider),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.sm,
                  AppSpacing.lg,
                  AppSpacing.sm,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.profileTheme,
                      style: AppTypography.bodyMedium.copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    SegmentedButton<ThemeMode>(
                      segments: [
                        ButtonSegment(
                          value: ThemeMode.system,
                          label: Text(l10n.profileThemeSystem),
                        ),
                        ButtonSegment(
                          value: ThemeMode.light,
                          label: Text(l10n.profileThemeLight),
                        ),
                        ButtonSegment(
                          value: ThemeMode.dark,
                          label: Text(l10n.profileThemeDark),
                        ),
                      ],
                      selected: {ref.watch(themeModeProvider)},
                      onSelectionChanged: (selection) {
                        ref.read(themeModeProvider.notifier).state =
                            selection.first;
                      },
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: colors.divider),
              AppListTile(
                leading: const Icon(Icons.notifications_none_rounded),
                title: l10n.profileNotifications,
                subtitle: l10n.profileComingSoon,
                enabled: false,
              ),
            ],
          ),

          // ── Support ──────────────────────────────────────────────────────
          _Section(
            title: l10n.profileSupportSection,
            children: [
              AppListTile(
                leading: const Icon(Icons.help_outline_rounded),
                title: l10n.profileHelpCenter,
                subtitle: l10n.profileComingSoon,
                enabled: false,
              ),
              AppListTile(
                leading: const Icon(Icons.mail_outline_rounded),
                title: l10n.profileContactSupport,
                subtitle: l10n.profileComingSoon,
                enabled: false,
              ),
            ],
          ),

          // ── Sign out ─────────────────────────────────────────────────────
          _Section(
            children: [
              AppListTile(
                leading: Icon(Icons.logout_rounded, color: colors.error),
                title: l10n.profileSignOut,
                isDestructive: true,
                onTap: () => _confirmSignOut(context, ref),
              ),
            ],
          ),

          if (version != null) ...[
            const SizedBox(height: AppSpacing.lg),
            Center(
              child: Text(
                l10n.appVersion(version),
                style: AppTypography.bodySmall.copyWith(
                  color: colors.textDisabled,
                ),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.xxl),
        ],
      ),
    );
  }

  Future<void> _confirmSignOut(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await AppDialog.confirm(
      context,
      title: l10n.profileSignOutConfirmTitle,
      body: l10n.profileSignOutConfirmBody,
      confirmLabel: l10n.profileSignOut,
      cancelLabel: l10n.teamCancel,
      isDanger: true,
    );
    if (confirmed != true) return;
    await ref.read(authProvider.notifier).logout();
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  String _planLabel(String code, AppLocalizations l10n) {
    return switch (code.toUpperCase()) {
      'FREE' => l10n.planFree,
      'PREMIUM' => l10n.planPremium,
      'BUSINESS' => l10n.planBusiness,
      'BUSINESS_PRO' => l10n.planBusinessPro,
      'API' => l10n.planApiIntegration,
      _ => '',
    };
  }

  String? _planSubtitle(
    int? daysRemaining,
    AppLocalizations l10n,
    String planLabel,
  ) {
    if (planLabel.isEmpty) return null;
    if (daysRemaining != null && daysRemaining > 0) {
      return l10n.profilePlanRenews(planLabel, daysRemaining);
    }
    return l10n.profilePlanNoRenewal(planLabel);
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.children, this.title});

  final String? title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Padding(
              padding: const EdgeInsets.only(left: AppSpacing.sm),
              child: Text(
                title!,
                style: AppTypography.labelMedium.copyWith(
                  color: colors.textSecondary,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          AppCard(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            // ListTile paints its ink on the nearest Material; without this
            // the card's own DecoratedBox hides the ripple (and trips a
            // debug assertion).
            child: Material(
              type: MaterialType.transparency,
              child: Column(children: children),
            ),
          ),
        ],
      ),
    );
  }
}
