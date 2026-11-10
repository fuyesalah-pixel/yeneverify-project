/// GENERATED CODE - DO NOT MODIFY BY HAND
/// *****************************************************
///  FlutterGen
/// *****************************************************

// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: directives_ordering,unnecessary_import,implicit_dynamic_list_literal,deprecated_member_use

import 'package:flutter/widgets.dart';

class $AssetsBanksGen {
  const $AssetsBanksGen();

  /// File path: assets/banks/README.md
  String get readme => 'assets/banks/README.md';

  /// List of all assets
  List<String> get values => [readme];
}

class $AssetsFontsGen {
  const $AssetsFontsGen();

  /// File path: assets/fonts/Inter-Bold.ttf
  String get interBold => 'assets/fonts/Inter-Bold.ttf';

  /// File path: assets/fonts/Inter-Medium.ttf
  String get interMedium => 'assets/fonts/Inter-Medium.ttf';

  /// File path: assets/fonts/Inter-Regular.ttf
  String get interRegular => 'assets/fonts/Inter-Regular.ttf';

  /// File path: assets/fonts/Inter-SemiBold.ttf
  String get interSemiBold => 'assets/fonts/Inter-SemiBold.ttf';

  /// File path: assets/fonts/NotoSansEthiopic.ttf
  String get notoSansEthiopic => 'assets/fonts/NotoSansEthiopic.ttf';

  /// File path: assets/fonts/OFL-Poppins.txt
  String get oFLPoppins => 'assets/fonts/OFL-Poppins.txt';

  /// File path: assets/fonts/Poppins-Bold.ttf
  String get poppinsBold => 'assets/fonts/Poppins-Bold.ttf';

  /// File path: assets/fonts/Poppins-Medium.ttf
  String get poppinsMedium => 'assets/fonts/Poppins-Medium.ttf';

  /// File path: assets/fonts/Poppins-Regular.ttf
  String get poppinsRegular => 'assets/fonts/Poppins-Regular.ttf';

  /// File path: assets/fonts/Poppins-SemiBold.ttf
  String get poppinsSemiBold => 'assets/fonts/Poppins-SemiBold.ttf';

  /// File path: assets/fonts/README.md
  String get readme => 'assets/fonts/README.md';

  /// List of all assets
  List<String> get values => [
        interBold,
        interMedium,
        interRegular,
        interSemiBold,
        notoSansEthiopic,
        oFLPoppins,
        poppinsBold,
        poppinsMedium,
        poppinsRegular,
        poppinsSemiBold,
        readme
      ];
}

class $AssetsIconsGen {
  const $AssetsIconsGen();

  /// File path: assets/icons/README.md
  String get readme => 'assets/icons/README.md';

  /// List of all assets
  List<String> get values => [readme];
}

class $AssetsImagesGen {
  const $AssetsImagesGen();

  /// Directory path: assets/images/illustrations
  $AssetsImagesIllustrationsGen get illustrations =>
      const $AssetsImagesIllustrationsGen();

  /// Directory path: assets/images/logo
  $AssetsImagesLogoGen get logo => const $AssetsImagesLogoGen();

  /// Directory path: assets/images/onboarding
  $AssetsImagesOnboardingGen get onboarding =>
      const $AssetsImagesOnboardingGen();
}

class $AssetsLottieGen {
  const $AssetsLottieGen();

  /// File path: assets/lottie/README.md
  String get readme => 'assets/lottie/README.md';

  /// List of all assets
  List<String> get values => [readme];
}

class $AssetsImagesIllustrationsGen {
  const $AssetsImagesIllustrationsGen();

  /// File path: assets/images/illustrations/README.md
  String get readme => 'assets/images/illustrations/README.md';

  /// List of all assets
  List<String> get values => [readme];
}

class $AssetsImagesLogoGen {
  const $AssetsImagesLogoGen();

  /// File path: assets/images/logo/README.md
  String get readme => 'assets/images/logo/README.md';

  /// File path: assets/images/logo/app_icon_1024.png
  AssetGenImage get appIcon1024 =>
      const AssetGenImage('assets/images/logo/app_icon_1024.png');

  /// File path: assets/images/logo/logo_dark.svg
  String get logoDark => 'assets/images/logo/logo_dark.svg';

  /// File path: assets/images/logo/logo_light.svg
  String get logoLight => 'assets/images/logo/logo_light.svg';

  /// File path: assets/images/logo/logo_mono.svg
  String get logoMono => 'assets/images/logo/logo_mono.svg';

  /// File path: assets/images/logo/logo_white.svg
  String get logoWhite => 'assets/images/logo/logo_white.svg';

  /// File path: assets/images/logo/mark_dark.svg
  String get markDark => 'assets/images/logo/mark_dark.svg';

  /// File path: assets/images/logo/mark_light.svg
  String get markLight => 'assets/images/logo/mark_light.svg';

  /// List of all assets
  List<dynamic> get values => [
        readme,
        appIcon1024,
        logoDark,
        logoLight,
        logoMono,
        logoWhite,
        markDark,
        markLight
      ];
}

class $AssetsImagesOnboardingGen {
  const $AssetsImagesOnboardingGen();

  /// File path: assets/images/onboarding/README.md
  String get readme => 'assets/images/onboarding/README.md';

  /// List of all assets
  List<String> get values => [readme];
}

class Assets {
  Assets._();

  static const $AssetsBanksGen banks = $AssetsBanksGen();
  static const $AssetsFontsGen fonts = $AssetsFontsGen();
  static const $AssetsIconsGen icons = $AssetsIconsGen();
  static const $AssetsImagesGen images = $AssetsImagesGen();
  static const $AssetsLottieGen lottie = $AssetsLottieGen();
}

class AssetGenImage {
  const AssetGenImage(
    this._assetName, {
    this.size,
    this.flavors = const {},
  });

  final String _assetName;

  final Size? size;
  final Set<String> flavors;

  Image image({
    Key? key,
    AssetBundle? bundle,
    ImageFrameBuilder? frameBuilder,
    ImageErrorWidgetBuilder? errorBuilder,
    String? semanticLabel,
    bool excludeFromSemantics = false,
    double? scale,
    double? width,
    double? height,
    Color? color,
    Animation<double>? opacity,
    BlendMode? colorBlendMode,
    BoxFit? fit,
    AlignmentGeometry alignment = Alignment.center,
    ImageRepeat repeat = ImageRepeat.noRepeat,
    Rect? centerSlice,
    bool matchTextDirection = false,
    bool gaplessPlayback = false,
    bool isAntiAlias = false,
    String? package,
    FilterQuality filterQuality = FilterQuality.low,
    int? cacheWidth,
    int? cacheHeight,
  }) {
    return Image.asset(
      _assetName,
      key: key,
      bundle: bundle,
      frameBuilder: frameBuilder,
      errorBuilder: errorBuilder,
      semanticLabel: semanticLabel,
      excludeFromSemantics: excludeFromSemantics,
      scale: scale,
      width: width,
      height: height,
      color: color,
      opacity: opacity,
      colorBlendMode: colorBlendMode,
      fit: fit,
      alignment: alignment,
      repeat: repeat,
      centerSlice: centerSlice,
      matchTextDirection: matchTextDirection,
      gaplessPlayback: gaplessPlayback,
      isAntiAlias: isAntiAlias,
      package: package,
      filterQuality: filterQuality,
      cacheWidth: cacheWidth,
      cacheHeight: cacheHeight,
    );
  }

  ImageProvider provider({
    AssetBundle? bundle,
    String? package,
  }) {
    return AssetImage(
      _assetName,
      bundle: bundle,
      package: package,
    );
  }

  String get path => _assetName;

  String get keyName => _assetName;
}
