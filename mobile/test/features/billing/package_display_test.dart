import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/billing/data/models/package.dart';
import 'package:yene_verify/features/billing/domain/package_display.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import 'billing_harness.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('formatEtbMinor renders two decimals and the currency', () {
    expect(formatEtbMinor(19900), '199.00 ETB');
    expect(formatEtbMinor(199900), '1,999.00 ETB');
    expect(formatEtbMinor(0), '0.00 ETB');
  });

  test('formatPackagePrice handles the custom API package', () {
    expect(
      formatPackagePrice(const Package(code: 'PREMIUM', name: 'Premium', priceMinor: '19900')),
      '199.00 ETB',
    );
    expect(
      formatPackagePrice(const Package(code: 'API', name: 'API')),
      '',
    );
  });

  test('packageNameFor maps every known code', () {
    expect(packageNameFor('FREE'), 'Free');
    expect(packageNameFor('PREMIUM'), 'Premium');
    expect(packageNameFor('BUSINESS'), 'Business');
    expect(packageNameFor('BUSINESS_PRO'), 'Business Pro');
    expect(packageNameFor('API'), 'API');
  });

  test('packageAction offers choose, upgrade, current and hides downgrades', () {
    final free = plan('FREE', displayOrder: 0);
    final premium = plan('PREMIUM', priceMinor: '19900');
    final business = plan('BUSINESS', priceMinor: '99900');

    expect(packageAction(free, 'FREE'), PackageAction.current);
    expect(packageAction(premium, 'FREE'), PackageAction.choose);
    expect(packageAction(business, 'FREE'), PackageAction.choose);
    expect(packageAction(premium, 'PREMIUM'), PackageAction.current);
    expect(packageAction(business, 'PREMIUM'), PackageAction.upgrade);
    expect(packageAction(premium, 'BUSINESS'), PackageAction.hidden);
    expect(packageAction(free, 'BUSINESS'), PackageAction.hidden);
    expect(packageAction(business, null), PackageAction.choose);
  });

  test('visiblePackages drops FREE, custom and downgrade plans', () {
    final fromFree = visiblePackages(defaultPlans, 'FREE');
    expect(fromFree.map((p) => p.code), ['PREMIUM', 'BUSINESS', 'BUSINESS_PRO']);

    final fromBusiness = visiblePackages(defaultPlans, 'BUSINESS');
    expect(fromBusiness.map((p) => p.code), ['BUSINESS_PRO']);

    final fromPro = visiblePackages(defaultPlans, 'BUSINESS_PRO');
    expect(fromPro, isEmpty);
  });

  test('packageFeatures renders credits/team seats per plan', () async {
    final l10n = await AppLocalizations.delegate.load(const Locale('en'));

    expect(
      packageFeatures(plan('PREMIUM', unlimited: true, creditsPerMonth: null), l10n),
      ['Unlimited verifications', '1 team member'],
    );
    expect(
      packageFeatures(plan('BUSINESS', creditsPerMonth: 400), l10n),
      ['400 verifications/month', '10 team members'],
    );
    expect(
      packageFeatures(plan('BUSINESS_PRO', unlimited: true, creditsPerMonth: null), l10n),
      ['Unlimited verifications', 'Unlimited team members'],
    );
  });
}
