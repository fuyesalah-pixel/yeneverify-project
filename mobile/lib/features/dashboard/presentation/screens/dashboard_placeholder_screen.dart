// Dashboard placeholder — Step 24 replaces internals.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../auth/domain/auth_notifier.dart' show authProvider;

class DashboardPlaceholderScreen extends ConsumerWidget {
  const DashboardPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);
    final auth = ref.watch(authProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.appName),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: l10n.logoutLabel,
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go(Routes.login);
            },
          ),
        ],
      ),
      backgroundColor: colors.background,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.dashboard, size: 64),
            const SizedBox(height: AppSpacing.md),
            const Text(
              'Dashboard (Step 24)',
              style: AppTypography.headingMedium,
            ),
            if (auth?.lastLoginPhone != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Signed in as ${auth!.lastLoginPhone}',
                style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
