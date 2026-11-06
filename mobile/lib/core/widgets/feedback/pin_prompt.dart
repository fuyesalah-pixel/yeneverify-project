// A modal PIN prompt for step-up protected actions.
//
// Returns the entered 4-digit PIN, or null when the user cancels. The
// caller exchanges it for a step-up token via POST /auth/pin/verify.
import 'package:flutter/material.dart';

import '../../theme/app_colors_extension.dart';
import '../../theme/app_typography.dart';
import '../buttons/app_button.dart';
import '../inputs/app_pin_field.dart';

abstract final class PinPrompt {
  static Future<String?> show(
    BuildContext context, {
    required String title,
    required String body,
    String? cancelLabel,
  }) {
    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _PinPromptDialog(
        title: title,
        body: body,
        cancelLabel: cancelLabel ?? 'Cancel',
      ),
    );
  }
}

class _PinPromptDialog extends StatefulWidget {
  const _PinPromptDialog({
    required this.title,
    required this.body,
    required this.cancelLabel,
  });

  final String title;
  final String body;
  final String cancelLabel;

  @override
  State<_PinPromptDialog> createState() => _PinPromptDialogState();
}

class _PinPromptDialogState extends State<_PinPromptDialog> {
  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return AlertDialog(
      backgroundColor: colors.surface,
      title: Text(
        widget.title,
        style: AppTypography.headingSmall.copyWith(color: colors.textPrimary),
        textAlign: TextAlign.center,
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            widget.body,
            style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          AppPinField(
            length: 4,
            onCompleted: (pin) => Navigator.of(context).pop(pin),
          ),
        ],
      ),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        AppButton(
          label: widget.cancelLabel,
          variant: AppButtonVariant.ghost,
          size: AppButtonSize.md,
          expand: false,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}
