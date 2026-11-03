// Tab metadata for the bottom navigation.
//
// Branches are declared in a fixed order in the router (dashboard, verify,
// history, insights, profile) so a hidden tab never renumbers the others.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

const int shellDashboardBranch = 0;
const int shellVerifyBranch = 1;
const int shellHistoryBranch = 2;
const int shellInsightsBranch = 3;
const int shellProfileBranch = 4;

class ShellTab {
  const ShellTab({
    required this.branchIndex,
    required this.icon,
    required this.activeIcon,
    required this.label,
  });

  final int branchIndex;
  final IconData icon;
  final IconData activeIcon;
  final String label;
}

/// Analytics endpoints are MERCHANT-only, so a sub-merchant never gets the
/// Insights tab rather than getting a tab that 403s.
bool canSeeInsights(String? role) => role != 'SUB_MERCHANT';

List<ShellTab> shellTabs(
  AppLocalizations l10n, {
  required bool isSubMerchant,
}) {
  return [
    ShellTab(
      branchIndex: shellDashboardBranch,
      icon: Icons.home_outlined,
      activeIcon: Icons.home_rounded,
      label: l10n.navHome,
    ),
    ShellTab(
      branchIndex: shellVerifyBranch,
      icon: Icons.document_scanner_outlined,
      activeIcon: Icons.document_scanner_rounded,
      label: l10n.navVerify,
    ),
    ShellTab(
      branchIndex: shellHistoryBranch,
      icon: Icons.receipt_long_outlined,
      activeIcon: Icons.receipt_long_rounded,
      label: l10n.navTransactions,
    ),
    if (!isSubMerchant)
      ShellTab(
        branchIndex: shellInsightsBranch,
        icon: Icons.insights_outlined,
        activeIcon: Icons.insights_rounded,
        label: l10n.navInsights,
      ),
    ShellTab(
      branchIndex: shellProfileBranch,
      icon: Icons.person_outline_rounded,
      activeIcon: Icons.person_rounded,
      label: l10n.navProfile,
    ),
  ];
}
