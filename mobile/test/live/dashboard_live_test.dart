// OPT-IN live smoke test for the Step 23A dashboard data layer.
//
//   LIVE_BACKEND=1 flutter test test/live/dashboard_live_test.dart \
//     --dart-define=API_BASE_URL=http://localhost:3000/api/v1
//
// It logs in as the SEEDED merchant (+251900665840) and calls the same API
// classes the dashboard uses, so a shape/envelope mismatch fails here rather
// than on a phone. The OTP is read from backend/dev-server.log (the dev
// backend does not echo it in the HTTP response).
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/env/app_env.dart';
import 'package:yene_verify/features/dashboard/data/analytics_api.dart';
import 'package:yene_verify/features/dashboard/data/merchants_api.dart';
import 'package:yene_verify/features/dashboard/data/notifications_api.dart';
import 'package:yene_verify/features/dashboard/data/subscription_api.dart';
import 'package:yene_verify/features/verify/data/verifications_api.dart';

const String _seedPhone = '+251900665840';

void main() {
  final live = Platform.environment['LIVE_BACKEND'] == '1';

  group(
    'live dashboard data layer',
    skip: live ? false : 'set LIVE_BACKEND=1 and a running backend',
    () {
      late Dio api;

      setUpAll(() async {
        final token = await _login(_seedPhone);
        api = Dio(
          BaseOptions(
            baseUrl: AppEnv.apiBaseUrl,
            headers: {'Authorization': 'Bearer $token'},
            validateStatus: (c) => c != null && c >= 200 && c < 300,
          ),
        );
      });

      test('merchants/me parses the real profile row', () async {
        final result = await MerchantsApi(api).getMe();
        // ignore: avoid_print
        print('LIVE merchants: err=${result.errorOrNull} name=${result.dataOrNull?.businessName} '
            'credits=${result.dataOrNull?.creditsBalance} '
            'plan=${result.dataOrNull?.currentPackageCode} '
            'counts=${result.dataOrNull?.verificationCount}');

        expect(result.isSuccess, isTrue, reason: '${result.errorOrNull}');
        expect(result.dataOrNull!.id, isNotEmpty);
      });

      test('analytics summary + trend parse', () async {
        final analytics = AnalyticsApi(api);
        final summary = await analytics.summary();
        final trend = await analytics.trend();
        // ignore: avoid_print
        print('LIVE analytics: summaryErr=${summary.errorOrNull} '
            'count=${summary.dataOrNull?.count} amount=${summary.dataOrNull?.amountMinor} '
            'days=${summary.dataOrNull?.days} | trendErr=${trend.errorOrNull} '
            'dir=${trend.dataOrNull?.direction} amountPct=${trend.dataOrNull?.amountPct}');

        expect(summary.isSuccess, isTrue, reason: '${summary.errorOrNull}');
        expect(trend.isSuccess, isTrue, reason: '${trend.errorOrNull}');
      });

      test('subscription and unread-count parse', () async {
        final subscription = await SubscriptionApi(api).me();
        final unread = await NotificationsApi(api).unreadCount();
        // ignore: avoid_print
        print('LIVE subscription: err=${subscription.errorOrNull} '
            'plan=${subscription.dataOrNull?.packageCode} '
            'credits=${subscription.dataOrNull?.creditsBalance} '
            'low=${subscription.dataOrNull?.lowBalance} | unread=${unread.dataOrNull}');

        expect(subscription.isSuccess, isTrue, reason: '${subscription.errorOrNull}');
        expect(unread.isSuccess, isTrue, reason: '${unread.errorOrNull}');
      });

      test('verifications list page parses with meta', () async {
        final page = await VerificationsApi(api).list(pageSize: 5);
        // ignore: avoid_print
        print('LIVE list: err=${page.errorOrNull} items=${page.dataOrNull?.items.length} '
            'total=${page.dataOrNull?.total} pages=${page.dataOrNull?.totalPages}');

        expect(page.isSuccess, isTrue, reason: '${page.errorOrNull}');
        expect(page.dataOrNull!.items.length, lessThanOrEqualTo(5));
      });
    },
  );
}

Future<String> _login(String phone) async {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppEnv.apiBaseUrl,
      validateStatus: (c) => c != null && c >= 200 && c < 300,
    ),
  );

  final log = File('${Directory.current.parent.path}/backend/dev-server.log');
  final fromByte = log.existsSync() ? log.lengthSync() : 0;

  await dio.post('/auth/request-otp', data: {'phone': phone});
  final code = await _latestOtp(phone, fromByte: fromByte);
  expect(code, isNotNull, reason: 'no OTP found in backend/dev-server.log');

  final res = await dio.post('/auth/verify-otp', data: {
    'phone': phone,
    'code': code,
    'device': {'fingerprint': 'live-dashboard-smoke', 'platform': 'ANDROID'},
  });
  final body = res.data as Map<String, dynamic>;
  final payload = (body['data'] as Map<String, dynamic>?) ?? body;
  return (payload['tokens'] as Map)['accessToken'] as String;
}

/// Newest `code: "123456"` written after [fromByte] for this phone's mask.
Future<String?> _latestOtp(String phone, {int fromByte = 0}) async {
  var dir = Directory.current;
  File? log;
  for (var i = 0; i < 4; i++) {
    final candidate = File('${dir.path}/backend/dev-server.log');
    if (candidate.existsSync()) {
      log = candidate;
      break;
    }
    dir = dir.parent;
  }
  if (log == null) return null;

  final mask = '+2519*****${phone.substring(phone.length - 2)}';
  for (var attempt = 0; attempt < 20; attempt++) {
    final all = await log.readAsBytes();
    final raw = utf8.decode(
      fromByte < all.length ? all.sublist(fromByte) : const <int>[],
      allowMalformed: true,
    );
    final text = raw.replaceAll(RegExp(r'\x1B\[[0-9;]*[A-Za-z]'), '');
    String? found;
    for (final m in RegExp(r'''code['"]?\s*[:=]\s*['"]?(\d{6})''').allMatches(text)) {
      final start = m.start - 400;
      final window = text.substring(start < 0 ? 0 : start, m.start);
      if (window.contains(mask)) found = m.group(1);
    }
    if (found != null) return found;
    await Future<void>.delayed(const Duration(milliseconds: 250));
  }
  return null;
}
