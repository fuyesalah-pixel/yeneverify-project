// Settings screen — sign-in methods, device management, preferences.
// Reachable from the Profile tab. Shows Google accounts paired to this
// device and allows revoking device bindings.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/feedback/app_dialog.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../../../core/widgets/layout/app_list_tile.dart';
import '../../../auth/data/models/device_account.dart';
import '../../../auth/domain/auth_notifier.dart';
import '../../../auth/domain/google_auth_provider.dart';
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final user = ref.watch(authProvider).valueOrNull?.user;
    final googleAuth = ref.watch(googleAuthProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: ListView(
        padding: AppSpacing.screen,
        children: [
          // ── Account ─────────────────────────────────────────────────
          _Section(
            title: l10n.profileAccountSection,
            children: [
              AppListTile(
                leading: const Icon(Icons.person_outlined),
                title: user?.fullName.isNotEmpty == true
                    ? user!.fullName
                    : l10n.profileUnknownUser,
                subtitle: maskEthiopianPhone(user?.phone ?? ''),
                enabled: false,
              ),
              if (user?.phone.isNotEmpty == true)
                AppListTile(
                  leading: const Icon(Icons.phone_outlined),
                  title: l10n.settingsPhone,
                  subtitle: maskEthiopianPhone(user!.phone),
                  enabled: false,
                ),
            ],
          ),

          // ── Sign-in methods ─────────────────────────────────────────
          _Section(
            title: l10n.settingsSignInMethods,
            children: [
              AppListTile(
                leading: const Icon(Icons.phone_android_rounded),
                title: l10n.settingsSignInPhone,
                subtitle: l10n.settingsSignInPhoneSubtitle,
                trailing: const Icon(Icons.check_circle_rounded, size: 20),
                enabled: false,
              ),
              if (googleAuth.deviceAccounts.isNotEmpty) ...[
                ...googleAuth.deviceAccounts.map(
                  (account) => AppListTile(
                    leading: const Icon(Icons.login_rounded),
                    title: account.googleEmail,
                    subtitle: l10n.settingsSignInGoogleSubtitle,
                    trailing: IconButton(
                      icon: const Icon(Icons.remove_circle_outline, size: 20),
                      color: colors.error,
                      onPressed: () => _confirmRemoveDevice(context, ref, account),
                    ),
                  ),
                ),
              ] else ...[
                AppListTile(
                  leading: const Icon(Icons.g_mobiledata_rounded),
                  title: l10n.settingsSignInGoogle,
                  subtitle: l10n.settingsSignInGoogleNotLinked,
                  trailing: const Icon(Icons.chevron_right_rounded, size: 20),
                  onTap: () => context.pushReplacement(Routes.login),
                ),
              ],
            ],
          ),

          // ── Devices ─────────────────────────────────────────────────
          if (googleAuth.deviceAccounts.isNotEmpty) ...[
            _Section(
              title: l10n.settingsDevicesTitle,
              children: [
                ...googleAuth.deviceAccounts.map(
                  (account) => AppListTile(
                    leading: const Icon(Icons.devices_rounded),
                    title: account.googleEmail,
                    subtitle: l10n.devicePhoneSuffix(account.phoneLast4),
                    trailing: IconButton(
                      icon: const Icon(Icons.remove_circle_outline, size: 20),
                      color: colors.error,
                      onPressed: () => _confirmRemoveDevice(context, ref, account),
                    ),
                  ),
                ),
              ],
            ),
          ],

          // ── Preferences ─────────────────────────────────────────────
          _Section(
            title: l10n.profilePreferencesSection,
            children: [
              AppListTile(
                leading: const Icon(Icons.dark_mode_outlined),
                title: l10n.profileTheme,
                trailing: const Icon(Icons.chevron_right_rounded, size: 20),
                onTap: () => context.push(Routes.profile),
              ),
              AppListTile(
                leading: const Icon(Icons.language_outlined),
                title: l10n.language,
                trailing: const Icon(Icons.chevron_right_rounded, size: 20),
                onTap: () => context.push(Routes.profile),
              ),
              AppListTile(
                leading: const Icon(Icons.notifications_none_rounded),
                title: l10n.profileNotifications,
                subtitle: l10n.profileComingSoon,
                enabled: false,
              ),
              AppListTile(
                leading: const Icon(Icons.vpn_key_outlined),
                title: l10n.profileSetUpPin,
                subtitle: l10n.profileSetUpPinSubtitle,
                trailing: const Icon(Icons.chevron_right_rounded, size: 20),
                onTap: () => context.push(Routes.pinSetup),
              ),
            ],
          ),

          // ── Support ─────────────────────────────────────────────────
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

          // ── Sign out ────────────────────────────────────────────────
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

          const SizedBox(height: AppSpacing.xxl),
        ],
      ),
    );
  }

  Future<void> _confirmRemoveDevice(
      BuildContext context, WidgetRef ref, DeviceAccount account) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await AppDialog.confirm(
      context,
      title: l10n.deviceRemoveConfirmTitle(account.googleEmail),
      body: l10n.deviceRemoveConfirmBody,
      confirmLabel: l10n.deviceRemove,
      cancelLabel: l10n.teamCancel,
      isDanger: true,
    );
    if (confirmed != true) return;
    await ref
        .read(googleAuthProvider.notifier)
        .signoutDeviceAccount(phoneLast4: account.phoneLast4);
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
}

String maskEthiopianPhone(String phone) {
  if (phone.length < 8) return phone;
  return '${phone.substring(0, 4)}•••${phone.substring(phone.length - 3)}';
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
