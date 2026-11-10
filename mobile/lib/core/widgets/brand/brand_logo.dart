import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Brand logo variants supplied in the Yene Verify brand kit.
enum BrandLogoVariant { full, mark }

/// Surface-aware artwork selection. [automatic] follows the app brightness;
/// [onBrand] is the white artwork for the green gradient splash.
enum BrandLogoAppearance { automatic, light, dark, onBrand }

/// # BrandLogo
///
/// The only widget that renders the Yene Verify logo. Use [variant] to choose
/// the full lockup or the shield mark, and let [appearance] pick the correct
/// supplied artwork for the surface.
///
/// The brand kit is the source of truth — never redraw, recolour, stretch or
/// recreate the wordmark with text.
class BrandLogo extends StatelessWidget {
  const BrandLogo({
    super.key,
    this.variant = BrandLogoVariant.full,
    this.appearance = BrandLogoAppearance.automatic,
    this.width,
    this.height,
    this.semanticLabel = 'Yene Verify',
  });

  final BrandLogoVariant variant;
  final BrandLogoAppearance appearance;
  final double? width;
  final double? height;
  final String semanticLabel;

  static const _logoLight = 'assets/images/logo/logo_light.svg';
  static const _logoDark = 'assets/images/logo/logo_dark.svg';
  static const _logoWhite = 'assets/images/logo/logo_white.svg';
  static const _markLight = 'assets/images/logo/mark_light.svg';
  static const _markDark = 'assets/images/logo/mark_dark.svg';

  BrandLogoAppearance _resolvedAppearance(BuildContext context) {
    if (appearance != BrandLogoAppearance.automatic) return appearance;
    return Theme.of(context).brightness == Brightness.dark
        ? BrandLogoAppearance.dark
        : BrandLogoAppearance.light;
  }

  String _assetFor(BrandLogoAppearance resolved) {
    if (variant == BrandLogoVariant.mark) {
      return resolved == BrandLogoAppearance.light ? _markLight : _markDark;
    }
    return switch (resolved) {
      BrandLogoAppearance.light => _logoLight,
      BrandLogoAppearance.dark => _logoDark,
      BrandLogoAppearance.onBrand => _logoWhite,
      BrandLogoAppearance.automatic => _logoLight,
    };
  }

  @override
  Widget build(BuildContext context) {
    final asset = _assetFor(_resolvedAppearance(context));

    return Semantics(
      image: true,
      label: semanticLabel,
      child: ExcludeSemantics(
        child: SvgPicture.asset(
          asset,
          width: width,
          height: height,
          fit: BoxFit.contain,
        ),
      ),
    );
  }
}

/// Animated logo entrance for the launch screen.
///
/// One-shot motion only: the splash must settle rather than loop, keeping the
/// screen calm and compatible with reduced-motion and widget tests.
class BrandSplashLogo extends StatefulWidget {
  const BrandSplashLogo({
    super.key,
    this.width,
    this.height,
    this.appearance = BrandLogoAppearance.onBrand,
    this.semanticLabel = 'Yene Verify',
  });

  final double? width;
  final double? height;
  final BrandLogoAppearance appearance;
  final String semanticLabel;

  @override
  State<BrandSplashLogo> createState() => _BrandSplashLogoState();
}

class _BrandSplashLogoState extends State<BrandSplashLogo>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;
  late final Animation<double> _scale;
  late final Animation<Offset> _offset;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    final curved = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    );
    _opacity = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0, 0.55)),
    );
    _scale = Tween<double>(begin: 0.92, end: 1).animate(curved);
    _offset = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(curved);
    _controller.forward();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.value = 1;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(
        position: _offset,
        child: ScaleTransition(
          scale: _scale,
          child: BrandLogo(
            appearance: widget.appearance,
            width: widget.width,
            height: widget.height,
            semanticLabel: widget.semanticLabel,
          ),
        ),
      ),
    );
  }
}
