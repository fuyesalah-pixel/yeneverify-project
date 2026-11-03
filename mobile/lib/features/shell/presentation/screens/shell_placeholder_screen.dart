// Honest placeholders for the tabs whose steps have not shipped yet.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/widgets/layout/app_empty_state.dart';

enum ShellSection { history, insights, profile }

class ShellPlaceholderScreen extends StatelessWidget {
  const ShellPlaceholderScreen({super.key, required this.section});

  final ShellSection section;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    final (title, body, icon) = switch (section) {
      ShellSection.history => (
          l10n.navTransactions,
          l10n.shellHistoryBody,
          Icons.receipt_long_outlined,
        ),
      ShellSection.insights => (
          l10n.navInsights,
          l10n.shellInsightsBody,
          Icons.insights_outlined,
        ),
      ShellSection.profile => (
          l10n.navProfile,
          l10n.shellProfileBody,
          Icons.person_outline_rounded,
        ),
    };

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(title)),
      body: AppEmptyState(
        icon: icon,
        title: l10n.shellComingSoon,
        body: body,
      ),
    );
  }
}
