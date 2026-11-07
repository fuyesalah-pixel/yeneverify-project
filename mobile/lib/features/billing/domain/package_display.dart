// Pure display helpers for the package list: price formatting, feature
// bullets, and which action a plan card offers for the current plan.
import 'package:intl/intl.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../sub_merchants/domain/plan_limits.dart';
import '../data/models/package.dart';

/// Plan ranks decide upgrade vs. downgrade. Downgrades are not supported in
/// the MVP, so a lower-ranked plan is hidden.
const Map<String, int> _planRank = {
  'FREE': 0,
  'PREMIUM': 1,
  'BUSINESS': 2,
  'BUSINESS_PRO': 3,
  'API': 4,
};

int planRank(String? code) => _planRank[(code ?? '').toUpperCase()] ?? -1;

/// 19900 → "199.00 ETB".
String formatEtbMinor(int minor, {String currency = 'ETB'}) {
  final amount = NumberFormat('#,##0.00').format(minor / 100);
  return '$amount $currency';
}

String formatPackagePrice(Package package) {
  final minor = package.priceValue;
  if (minor == null) return '';
  return formatEtbMinor(minor, currency: package.currency);
}

/// Human label for a package code, for rows that only carry the code
/// (billing history).
String packageNameFor(String code) {
  return switch (code.toUpperCase()) {
    'FREE' => 'Free',
    'PREMIUM' => 'Premium',
    'BUSINESS' => 'Business',
    'BUSINESS_PRO' => 'Business Pro',
    'API' => 'API',
    _ => code,
  };
}

enum PackageAction { choose, upgrade, current, hidden }

/// What the plan card offers, given the merchant's current plan.
PackageAction packageAction(Package package, String? currentCode) {
  if (currentCode != null &&
      currentCode.isNotEmpty &&
      package.code == currentCode) {
    return PackageAction.current;
  }
  final current = planRank(currentCode);
  final target = planRank(package.code);
  // No plan yet, or the free plan: every paid plan is a first purchase.
  if (current <= 0) return PackageAction.choose;
  if (target <= current) return PackageAction.hidden;
  return PackageAction.upgrade;
}

/// Plans worth showing: purchasable, not FREE (auto-provisioned), and not a
/// downgrade from the current plan.
List<Package> visiblePackages(List<Package> all, String? currentCode) {
  final visible = all
      .where((p) => p.isPurchasable)
      .where((p) {
        final action = packageAction(p, currentCode);
        return action == PackageAction.choose ||
            action == PackageAction.upgrade;
      })
      .toList();
  visible.sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
  return visible;
}

/// Feature bullets under a plan name.
List<String> packageFeatures(Package package, AppLocalizations l10n) {
  final features = <String>[
    package.unlimited
        ? l10n.billingFeatureUnlimited
        : l10n.billingFeatureCredits(package.creditsPerMonth ?? 0),
  ];
  final seats = subMerchantLimitFor(package.code);
  if (seats == null) {
    features.add(l10n.billingFeatureSeatsUnlimited);
  } else if (seats == 1) {
    features.add(l10n.billingFeatureSeatsOne);
  } else {
    features.add(l10n.billingFeatureSeats(seats));
  }
  return features;
}
