// Greeting + notification bell. Deliberately not an AppBar: the greeting is
// content, and the hero card below carries the business name.
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_typography.dart';

class DashboardHeader extends StatelessWidget {
  const DashboardHeader({
    super.key,
    required this.greeting,
    required this.unreadCount,
    required this.onNotifications,
    required this.notificationsTooltip,
  });

  final String greeting;
  final int unreadCount;
  final VoidCallback onNotifications;
  final String notificationsTooltip;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Row(
      children: [
        Expanded(
          child: Text(
            greeting,
            style: AppTypography.headingMedium.copyWith(
              color: colors.textPrimary,
            ),
          ),
        ),
        IconButton(
          tooltip: notificationsTooltip,
          onPressed: onNotifications,
          icon: Badge(
            isLabelVisible: unreadCount > 0,
            label: Text(unreadCount > 99 ? '99+' : '$unreadCount'),
            backgroundColor: colors.error,
            textColor: colors.onPrimary,
            child: Icon(
              Icons.notifications_none_rounded,
              color: colors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }
}
