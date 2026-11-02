import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// # AppPinField
///
/// A dot-based 4 or 6-digit PIN entry field.
///
/// ## Visual behaviour
/// - Filled dots = entered digits. Empty dots = remaining.
/// - Supports 4-digit and 6-digit PINs (set [length]).
/// - [hasError] triggers a shake animation + red dots.
/// - Hidden keyboard input — user taps the field to open keyboard.
///
/// ## When to use
/// - PIN set-up screen (first login).
/// - PIN unlock screen (subsequent logins).
/// - Sensitive action confirmation.
///
/// ## Do NOT
/// - Show the actual digit characters (security).
/// - Use for OTP (use [AppOtpField] instead).
///
/// ## Example
/// ```dart
/// AppPinField(
///   length: 6,
///   onCompleted: (pin) => ref.read(pinProvider.notifier).verifyPin(pin),
///   hasError: state.hasPinError,
/// )
/// ```
class AppPinField extends StatefulWidget {
  const AppPinField({
    super.key,
    required this.onCompleted,
    this.onChanged,
    this.hasError = false,
    this.length = 6,
    this.autofocus = true,
  });

  final ValueChanged<String> onCompleted;
  final ValueChanged<String>? onChanged;
  final bool hasError;
  final int length;
  final bool autofocus;

  @override
  State<AppPinField> createState() => _AppPinFieldState();
}

class _AppPinFieldState extends State<AppPinField>
    with SingleTickerProviderStateMixin {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  late AnimationController _shakeController;
  late Animation<double> _shakeAnimation;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _shakeAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: -10), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -10, end: 10), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 10, end: -10), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -10, end: 10), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 10, end: 0), weight: 1),
    ]).animate(CurvedAnimation(parent: _shakeController, curve: Curves.easeOut));

    _controller.addListener(() {
      setState(() {});
      widget.onChanged?.call(_controller.text);
      if (_controller.text.length == widget.length) {
        widget.onCompleted(_controller.text);
      }
    });
  }

  @override
  void didUpdateWidget(AppPinField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.hasError && !oldWidget.hasError) {
      HapticFeedback.heavyImpact();
      _shakeController.forward(from: 0).then((_) {
        _controller.clear();
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    _shakeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final entered = _controller.text.length;

    return GestureDetector(
      onTap: () => _focusNode.requestFocus(),
      child: AnimatedBuilder(
        animation: _shakeAnimation,
        builder: (context, child) => Transform.translate(
          offset: Offset(_shakeAnimation.value, 0),
          child: child,
        ),
        child: Stack(
          children: [
            // Hidden real input
            Opacity(
              opacity: 0,
              child: SizedBox(
                width: 1,
                height: 1,
                child: TextField(
                  controller: _controller,
                  focusNode: _focusNode,
                  autofocus: widget.autofocus,
                  keyboardType: TextInputType.number,
                  maxLength: widget.length,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(counterText: ''),
                ),
              ),
            ),
            // Dot display
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(widget.length, (index) {
                final isFilled = index < entered;
                final dotColor = widget.hasError
                    ? colors.error
                    : isFilled
                        ? colors.primaryAction
                        : colors.border;

                return Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                  ),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    curve: Curves.easeOutCubic,
                    width: isFilled ? 16 : 14,
                    height: isFilled ? 16 : 14,
                    decoration: BoxDecoration(
                      color: isFilled ? dotColor : AppColors.transparent,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: dotColor,
                        width: 1.5,
                      ),
                    ),
                  ),
                );
              }),
            ),
          ],
        ),
      ),
    );
  }
}

/// Utility: clear the pin field externally by passing a new key or
/// calling the controller directly if exposed. For most use-cases,
/// resetting happens inside [_AppPinFieldState] on error.
///
/// Label for accessibility — add to the parent widget:
/// ```dart
/// Semantics(label: context.l10n.enterPin, child: AppPinField(...))
/// ```
class PinLabel extends StatelessWidget {
  const PinLabel({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Text(
      text,
      style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
      textAlign: TextAlign.center,
    );
  }
}
