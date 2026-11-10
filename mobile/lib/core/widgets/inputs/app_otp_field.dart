import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_radii.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// # AppOtpField
///
/// A row of 6 individual digit boxes for OTP entry.
///
/// ## Behaviour
/// - Auto-advances to next box on digit entry.
/// - Backspace on empty box focuses previous box.
/// - Pastes a 6-digit string across all boxes automatically.
/// - Fires [onCompleted] when all 6 digits are filled.
/// - Shows [hasError] state (red border + shake) on wrong OTP.
///
/// ## Do NOT
/// - Use a single [TextField] for OTP — use this component only.
/// - Handle OTP navigation logic in the screen — it lives here.
///
/// ## Example
/// ```dart
/// AppOtpField(
///   onCompleted: (code) => _handleCode(code),
///   hasError: state.hasOtpError,
/// )
/// ```
class AppOtpField extends StatefulWidget {
  const AppOtpField({
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
  State<AppOtpField> createState() => _AppOtpFieldState();
}

class _AppOtpFieldState extends State<AppOtpField>
    with SingleTickerProviderStateMixin {
  late List<TextEditingController> _controllers;
  late List<FocusNode> _focusNodes;
  late AnimationController _shakeController;
  late Animation<double> _shakeAnimation;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(widget.length, (_) => TextEditingController());
    _focusNodes = List.generate(widget.length, (i) => FocusNode());

    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _shakeAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: -8), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -8, end: 8), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 8, end: -8), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -8, end: 8), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 8, end: 0), weight: 1),
    ]).animate(CurvedAnimation(parent: _shakeController, curve: Curves.easeOut));
  }

  @override
  void didUpdateWidget(AppOtpField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.hasError && !oldWidget.hasError) {
      _shakeController.forward(from: 0);
    }
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    _shakeController.dispose();
    super.dispose();
  }

  String get _currentCode =>
      _controllers.map((c) => c.text).join();

  void _onChanged(int index, String value) {
    if (value.length > 1) {
      // Handle paste: distribute across boxes
      final digits = value.replaceAll(RegExp(r'\D'), '');
      for (int i = 0; i < widget.length && i < digits.length; i++) {
        _controllers[i].text = digits[i];
      }
      final nextIndex = digits.length < widget.length
          ? digits.length
          : widget.length - 1;
      _focusNodes[nextIndex].requestFocus();
    } else if (value.isNotEmpty) {
      _controllers[index].text = value;
      if (index < widget.length - 1) {
        _focusNodes[index + 1].requestFocus();
      } else {
        _focusNodes[index].unfocus();
      }
    }

    widget.onChanged?.call(_currentCode);

    if (_currentCode.length == widget.length) {
      widget.onCompleted(_currentCode);
    }
  }

  void _onKeyEvent(int index, KeyEvent event) {
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.backspace &&
        _controllers[index].text.isEmpty &&
        index > 0) {
      _focusNodes[index - 1].requestFocus();
      _controllers[index - 1].clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return AnimatedBuilder(
      animation: _shakeAnimation,
      builder: (context, child) => Transform.translate(
        offset: Offset(_shakeAnimation.value, 0),
        child: child,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(widget.length, (index) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
            child: SizedBox(
              width: 48,
              height: 56,
              child: Focus(
                onKeyEvent: (_, event) {
                  _onKeyEvent(index, event);
                  return KeyEventResult.ignored;
                },
                child: TextField(
                  controller: _controllers[index],
                  focusNode: _focusNodes[index],
                  autofocus: widget.autofocus && index == 0,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  maxLength: 1,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: AppTypography.headingSmall.copyWith(
                    color: colors.textPrimary,
                  ),
                  decoration: InputDecoration(
                    counterText: '',
                    contentPadding: EdgeInsets.zero,
                    enabledBorder: OutlineInputBorder(
                      borderRadius: AppRadii.radiusMd,
                      borderSide: BorderSide(
                        color: widget.hasError ? colors.error : colors.border,
                        width: widget.hasError ? 1.5 : 1,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: AppRadii.radiusMd,
                      borderSide: BorderSide(
                        color: widget.hasError
                            ? colors.error
                            : colors.primaryAction,
                        width: 1.5,
                      ),
                    ),
                    filled: true,
                    fillColor: colors.surfaceAlt,
                  ),
                  onChanged: (v) => _onChanged(index, v),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
