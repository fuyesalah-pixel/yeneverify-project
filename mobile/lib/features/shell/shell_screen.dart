// Bottom-navigation shell for every signed-in surface.
//
// Tabs are driven by [shellTabs]: five for a merchant, four for a
// sub-merchant (no Insights). The unread badge is user-scoped, so it works
// for both roles.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../core/theme/app_colors_extension.dart';
import '../../core/theme/app_typography.dart';
import '../auth/domain/auth_notifier.dart';
import '../dashboard/presentation/providers/dashboard_provider.dart';
import 'shell_controller.dart';

class ShellScreen extends ConsumerWidget {
  const ShellScreen({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final role = ref.watch(authProvider).valueOrNull?.user?.role;
    final tabs = shellTabs(l10n, isSubMerchant: !canSeeInsights(role));
    final unread = ref.watch(unreadCountProvider).valueOrNull ?? 0;

    final index = tabs.indexWhere(
      (tab) => tab.branchIndex == navigationShell.currentIndex,
    );
    final selectedIndex = index < 0 ? 0 : index;

    return Scaffold(
      backgroundColor: colors.background,
      body: navigationShell,
      // "Transactions" is 12 characters; at the theme's default label size it
      // wrapped mid-word on a 360 dp screen, so the shell labels run smaller.
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          labelTextStyle: WidgetStatePropertyAll(
            AppTypography.labelSmall.copyWith(fontSize: 10, letterSpacing: 0),
          ),
        ),
        child: NavigationBar(
          selectedIndex: selectedIndex,
          backgroundColor: colors.surface,
          indicatorColor: colors.primaryAction.withValues(alpha: 0.12),
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          onDestinationSelected: (destination) {
            final tab = tabs[destination];
            navigationShell.goBranch(
              tab.branchIndex,
              initialLocation: tab.branchIndex == navigationShell.currentIndex,
            );
          },
          destinations: [
            for (final tab in tabs)
              NavigationDestination(
                icon: tab.branchIndex == shellDashboardBranch
                    ? Badge(
                        isLabelVisible: unread > 0,
                        backgroundColor: colors.error,
                        textColor: colors.onPrimary,
                        label: Text(unread > 99 ? '99+' : '$unread'),
                        child: Icon(tab.icon),
                      )
                    : Icon(tab.icon),
                selectedIcon: Icon(tab.activeIcon, color: colors.primaryAction),
                label: tab.label,
              ),
          ],
        ),
      ),
    );
  }
}
