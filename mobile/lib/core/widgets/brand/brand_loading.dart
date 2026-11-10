import 'package:flutter/material.dart';

import '../../theme/app_colors_extension.dart';
import '../../theme/app_radii.dart';
import 'brand_logo.dart';

/// Branded indeterminate loader derived from the supplied loading design:
/// a softly pulsing shield-check with a restrained green progress sweep.
class BrandLoadingMark extends StatefulWidget {
  const BrandLoadingMark({
    super.key,
    this.size = 112,
    this.semanticLabel = 'Verifying',
  });

  final double size;
  final String semanticLabel;

  @override
  State<BrandLoadingMark> createState() => _BrandLoadingMarkState();
}

class _BrandLoadingMarkState extends State<BrandLoadingMark>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller
        ..stop()
        ..value = 1;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      label: widget.semanticLabel,
      image: true,
      child: ExcludeSemantics(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final t = Curves.easeInOut.transform(_controller.value);
            final scale = 0.97 + (t * 0.03);
            final opacity = 0.72 + (t * 0.28);

            return Transform.scale(
              scale: scale,
              child: Opacity(
                opacity: opacity,
                child: Container(
                  width: widget.size,
                  height: widget.size,
                  padding: EdgeInsets.all(widget.size * 0.18),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        colors.primaryAction.withValues(alpha: 0.14),
                        colors.primaryAction.withValues(alpha: 0),
                      ],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: colors.primaryAction.withValues(alpha: 0.14),
                        blurRadius: widget.size * 0.28,
                        spreadRadius: widget.size * 0.04,
                      ),
                    ],
                  ),
                  child: child,
                ),
              ),
            );
          },
          child: BrandLogo(
            variant: BrandLogoVariant.mark,
            appearance: Theme.of(context).brightness == Brightness.dark
                ? BrandLogoAppearance.dark
                : BrandLogoAppearance.light,
            semanticLabel: widget.semanticLabel,
          ),
        ),
      ),
    );
  }
}

/// Thin brand-gradient progress line for indeterminate work.
class BrandProgressLine extends StatefulWidget {
  const BrandProgressLine({super.key});

  @override
  State<BrandProgressLine> createState() => _BrandProgressLineState();
}

class _BrandProgressLineState extends State<BrandProgressLine>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller
        ..stop()
        ..value = 1;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      label: 'Loading',
      child: ClipRRect(
        borderRadius: AppRadii.radiusPill,
        child: SizedBox(
          height: 6,
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: colors.surfaceAlt),
              AnimatedBuilder(
                animation: _controller,
                builder: (context, _) {
                  return FractionallySizedBox(
                    alignment: Alignment(-1.35 + (_controller.value * 2.7), 0),
                    widthFactor: 0.38,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: AppRadii.radiusPill,
                        gradient: LinearGradient(
                          colors: [
                            colors.primaryActionPressed,
                            colors.primaryAction,
                            colors.brandAccent,
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
