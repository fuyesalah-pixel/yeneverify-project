// Billing overview: catalog + current subscription + role, history, detail.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../auth/domain/auth_notifier.dart';
import '../../../dashboard/data/models/subscription_me.dart';
import '../../../profile/presentation/providers/profile_providers.dart';
import '../../data/billing_api.dart';
import '../../data/models/billing_verification.dart';
import '../../data/models/package.dart';
import '../../data/packages_api.dart';

final packagesProvider = FutureProvider<List<Package>>((ref) async {
  final result = await ref.watch(packagesApiProvider).list();
  return result.dataOrNull ?? const [];
});

class BillingOverview {
  const BillingOverview({
    required this.packages,
    required this.isMerchant,
    this.subscription,
  });

  final List<Package> packages;
  final bool isMerchant;
  final SubscriptionMe? subscription;

  String? get currentPackageCode {
    final code = subscription?.packageCode;
    return code == null || code.isEmpty ? null : code;
  }
}

final billingOverviewProvider = FutureProvider<BillingOverview>((ref) async {
  final role = ref.watch(authProvider).valueOrNull?.user?.role;
  final packages = await ref.watch(packagesProvider.future);
  // The subscription is best effort: a failure still lets the catalog render.
  final subscription = await ref.watch(subscriptionMeProvider.future);
  return BillingOverview(
    packages: packages,
    isMerchant: role != 'SUB_MERCHANT',
    subscription: subscription,
  );
});

/// Past billing attempts, newest first.
final billingHistoryProvider = FutureProvider<List<BillingSummary>>((ref) async {
  final result = await ref.watch(billingApiProvider).list(pageSize: 50);
  return result.dataOrNull?.items ?? const [];
});

/// One billing session, refetched while it is PENDING.
final billingDetailProvider =
    FutureProvider.family<BillingVerification?, String>((ref, id) async {
  final result = await ref.watch(billingApiProvider).getById(id);
  return result.dataOrNull;
});
