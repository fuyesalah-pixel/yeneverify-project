import 'package:flutter/material.dart';

import '../../theme/app_colors_extension.dart';

/// Full-screen brand surface used by the launch screen.
///
/// Light mode uses the signature green gradient from the supplied splash;
/// dark mode keeps the same depth with a restrained black-green radial glow.
class BrandSplashBackground extends StatelessWidget {
  const BrandSplashBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: RadialGradient(
          center:
              isDark ? const Alignment(0, -0.25) : const Alignment(-0.4, -0.8),
          radius: isDark ? 0.95 : 1.15,
          colors: isDark
              ? [colors.brandDeep, colors.background]
              : [
                  colors.primaryAction,
                  colors.primaryActionPressed,
                  colors.brandDeep,
                ],
          stops: isDark ? const [0, 1] : const [0, 0.48, 1],
        ),
      ),
      child: child,
    );
  }
}
