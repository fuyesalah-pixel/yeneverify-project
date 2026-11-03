import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/features/dashboard/data/models/analytics_summary.dart';
import 'package:yene_verify/features/dashboard/presentation/providers/dashboard_provider.dart';

import 'dashboard_provider_test.dart' as fakes;

void main() {
  test('a failed analytics call leaves the rest of the dashboard intact',
      () async {
    final container = ProviderContainer(
      overrides: fakes.dashboardOverrides(
        summary: const Failure<AnalyticsSummary>(
          ApiError(code: 'AUTH_FORBIDDEN', httpStatus: 403),
        ),
      ),
    );
    addTearDown(container.dispose);

    final data = await container.read(dashboardProvider.future);

    expect(data.merchant.businessName, 'Diag Mart');
    expect(data.summary, isNull);
    expect(data.trend, isNotNull);
    expect(data.subscription, isNotNull);
    expect(data.recent, isNotEmpty);
    expect(data.partial, isTrue);
  });

  test('a failed merchant call is fatal — there is no dashboard without it',
      () async {
    final container = ProviderContainer(
      overrides: fakes.dashboardOverrides(
        merchant: const Failure(
          ApiError(code: 'NETWORK_ERROR', kind: ApiErrorKind.network),
        ),
      ),
    );
    addTearDown(container.dispose);

    await expectLater(
      container.read(dashboardProvider.future),
      throwsA(isA<ApiError>()),
    );
  });
}
