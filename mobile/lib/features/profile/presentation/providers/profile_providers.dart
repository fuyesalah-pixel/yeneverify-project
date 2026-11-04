// Profile tab data: identity comes from authProvider; business + plan come
// from the same endpoints the dashboard uses (best effort).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../../dashboard/data/merchants_api.dart';
import '../../../dashboard/data/models/merchant_me.dart';
import '../../../dashboard/data/models/subscription_me.dart';
import '../../../dashboard/data/subscription_api.dart';

final merchantMeProvider = FutureProvider<MerchantMe?>((ref) async {
  final result = await ref.watch(merchantsApiProvider).getMe();
  return result.dataOrNull;
});

final subscriptionMeProvider = FutureProvider<SubscriptionMe?>((ref) async {
  final result = await ref.watch(subscriptionApiProvider).me();
  return result.dataOrNull;
});

/// App version for the footer. Overridden in widget tests (the plugin has no
/// platform channel there).
final appVersionProvider = FutureProvider<String>((ref) async {
  final info = await PackageInfo.fromPlatform();
  return info.version;
});
