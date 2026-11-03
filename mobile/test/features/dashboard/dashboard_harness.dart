import 'package:flutter/material.dart';
import 'package:yene_verify/core/theme/app_theme.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

/// Real theme tokens + real l10n, so widget tests assert the shipped copy.
Widget dashboardTestApp(Widget child) {
  return MaterialApp(
    theme: AppTheme.lightTheme(),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    locale: const Locale('en'),
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}
