// Mobile-only. Orchestrates OnboardingApi + the auth state refresh.
//
// Onboarding status is the router's source of truth, so every successful
// state-changing call re-fetches /onboarding/status before returning.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_result.dart';
import '../../../core/network/dio_client.dart';
import '../../auth/domain/auth_notifier.dart';
import 'models/create_merchant_request.dart';
import 'models/create_merchant_response.dart';
import 'onboarding_api.dart';

abstract interface class OnboardingRepository {
  Future<ApiResult<CreateMerchantResponse>> createMerchant(
    CreateMerchantRequest request,
  );

  Future<ApiResult<AcceptInviteResponse>> acceptInvite(String token);

  Future<ApiResult<bool>> declineInvite(String token);
}

class HttpOnboardingRepository implements OnboardingRepository {
  HttpOnboardingRepository({required OnboardingApi api, required Ref ref})
      : _api = api,
        _ref = ref;

  final OnboardingApi _api;
  final Ref _ref;

  @override
  Future<ApiResult<CreateMerchantResponse>> createMerchant(
    CreateMerchantRequest request,
  ) async {
    final result = await _api.createMerchant(request);
    if (result is Success<CreateMerchantResponse>) {
      await _ref.read(authProvider.notifier).refreshOnboardingStatus();
    }
    return result;
  }

  @override
  Future<ApiResult<AcceptInviteResponse>> acceptInvite(String token) async {
    final result = await _api.acceptInvite(token);
    if (result is Success<AcceptInviteResponse>) {
      // Accept flips the role to SUB_MERCHANT, so status becomes COMPLETE.
      await _ref.read(authProvider.notifier).refreshOnboardingStatus();
    }
    return result;
  }

  @override
  Future<ApiResult<bool>> declineInvite(String token) async {
    final result = await _api.declineInvite(token);
    if (result is Success<bool>) {
      // Declining deletes the INVITED row; for a MERCHANT account this
      // re-exposes the merchant-profile step.
      await _ref.read(authProvider.notifier).refreshOnboardingStatus();
    }
    return result;
  }
}

final onboardingApiProvider = Provider<OnboardingApi>((ref) {
  return OnboardingApi(ref.watch(dioProvider));
});

final onboardingRepositoryProvider = Provider<OnboardingRepository>((ref) {
  return HttpOnboardingRepository(
    api: ref.watch(onboardingApiProvider),
    ref: ref,
  );
});
