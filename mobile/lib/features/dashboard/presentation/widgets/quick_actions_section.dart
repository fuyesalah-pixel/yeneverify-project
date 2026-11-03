// Two up-front actions: the product's core job, and the list behind it.
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/layout/app_card.dart';

class QuickActionsSection extends StatelessWidget {
  const QuickActionsSection({
    super.key,
    required this.verifyTitle,
    required this.verifyBody,
    required this.transactionsTitle,
    required this.transactionsBody,
    required this.onVerify,
    required this.onTransactions,
  });

  final String verifyTitle;
  final String verifyBody;
  final String transactionsTitle;
  final String transactionsBody;
  final VoidCallback onVerify;
  final VoidCallback onTransactions;

  @override
  Widget build(BuildContext context) {
    // IntrinsicHeight bounds the row so both cards can stretch to the taller
    // one; the dashboard renders this inside an unbounded ListView.
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: _ActionCard(
              icon: Icons.document_scanner_outlined,
              title: verifyTitle,
              body: verifyBody,
              tinted: true,
              onTap: onVerify,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: _ActionCard(
              icon: Icons.receipt_long_outlined,
              title: transactionsTitle,
              body: transactionsBody,
              onTap: onTransactions,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.title,
    required this.body,
    required this.onTap,
    this.tinted = false,
  });

  final IconData icon;
  final String title;
  final String body;
  final VoidCallback onTap;
  final bool tinted;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return AppCard(
      variant: tinted ? AppCardVariant.tinted : AppCardVariant.default_,
      onTap: onTap,
      padding: AppSpacing.insetLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            size: 22,
            color: tinted ? colors.primaryAction : colors.textPrimary,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            title,
            style: AppTypography.labelLarge.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: AppSpacing.micro),
          Text(
            body,
            style: AppTypography.bodySmall.copyWith(
              color: colors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
