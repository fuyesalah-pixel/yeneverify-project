// Merchant setup form state + submission (Step 22A).
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/network/api_result.dart';
import '../../../auth/domain/auth_notifier.dart';
import '../../data/models/create_merchant_request.dart';
import '../../data/models/create_merchant_response.dart';
import '../../data/onboarding_repository.dart';
import '../../domain/business_types.dart';

enum MerchantSubmitOutcome { success, alreadyOnboarded, failed }

class MerchantSetupState {
  const MerchantSetupState({
    this.businessName = '',
    this.businessType,
    this.tin = '',
    this.address = '',
    this.city = 'Addis Ababa',
    this.isSubmitting = false,
    this.showDetails = false,
    this.error,
    this.businessNameError,
    this.merchant,
  });

  final String businessName;
  final BusinessType? businessType;
  final String tin;
  final String address;
  final String city;
  final bool isSubmitting;
  final bool showDetails;
  final ApiError? error;
  final BusinessNameError? businessNameError;
  final CreateMerchantResponse? merchant;

  bool get isBusinessNameValid => validateBusinessName(businessName) == null;

  MerchantSetupState copyWith({
    String? businessName,
    BusinessType? businessType,
    String? tin,
    String? address,
    String? city,
    bool? isSubmitting,
    bool? showDetails,
    ApiError? error,
    BusinessNameError? businessNameError,
    CreateMerchantResponse? merchant,
    bool clearError = false,
    bool clearBusinessNameError = false,
    bool clearBusinessType = false,
  }) {
    return MerchantSetupState(
      businessName: businessName ?? this.businessName,
      businessType:
          clearBusinessType ? null : (businessType ?? this.businessType),
      tin: tin ?? this.tin,
      address: address ?? this.address,
      city: city ?? this.city,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      showDetails: showDetails ?? this.showDetails,
      error: clearError ? null : (error ?? this.error),
      businessNameError: clearBusinessNameError
          ? null
          : (businessNameError ?? this.businessNameError),
      merchant: merchant ?? this.merchant,
    );
  }
}

class MerchantSetupNotifier
    extends AutoDisposeAsyncNotifier<MerchantSetupState> {
  @override
  Future<MerchantSetupState> build() async => const MerchantSetupState();

  MerchantSetupState? get _current => state.valueOrNull;

  void _update(MerchantSetupState next) => state = AsyncData(next);

  void setBusinessName(String value) {
    final current = _current;
    if (current == null) return;
    _update(current.copyWith(
      businessName: value,
      clearBusinessNameError: true,
      clearError: true,
    ));
  }

  void setBusinessType(BusinessType? type) {
    final current = _current;
    if (current == null) return;
    _update(type == null
        ? current.copyWith(clearBusinessType: true)
        : current.copyWith(businessType: type));
  }

  void setTin(String value) {
    final current = _current;
    if (current == null) return;
    _update(current.copyWith(tin: value));
  }

  void setAddress(String value) {
    final current = _current;
    if (current == null) return;
    _update(current.copyWith(address: value));
  }

  void setCity(String value) {
    final current = _current;
    if (current == null) return;
    _update(current.copyWith(city: value));
  }

  void toggleDetails() {
    final current = _current;
    if (current == null) return;
    _update(current.copyWith(showDetails: !current.showDetails));
  }

  /// Submits the form. The repository refreshes /onboarding/status on
  /// success, so the router releases /dashboard before the success screen
  /// hands over.
  Future<MerchantSubmitOutcome> submit() async {
    final current = _current;
    if (current == null || current.isSubmitting) {
      return MerchantSubmitOutcome.failed;
    }

    final name = current.businessName.trim();
    final validation = validateBusinessName(name);
    if (validation != null) {
      _update(current.copyWith(businessNameError: validation));
      return MerchantSubmitOutcome.failed;
    }

    _update(current.copyWith(
      businessName: name,
      isSubmitting: true,
      clearError: true,
      clearBusinessNameError: true,
    ));

    final result = await ref.read(onboardingRepositoryProvider).createMerchant(
          CreateMerchantRequest(
            businessName: name,
            businessType: current.businessType?.wireValue,
            tin: _optional(current.tin),
            address: _optional(current.address),
            city: _optional(current.city),
          ),
        );

    final latest = _current ?? current;

    switch (result) {
      case Success<CreateMerchantResponse>(:final data):
        ref.read(authProvider.notifier).setBusinessName(data.businessName);
        _update(latest.copyWith(
          isSubmitting: false,
          businessName: data.businessName,
          merchant: data,
        ));
        return MerchantSubmitOutcome.success;

      case Failure<CreateMerchantResponse>(:final error):
        if (error.code == 'MERCHANT_ALREADY_ONBOARDED') {
          // Onboarding completed on another device while this form was open.
          await ref.read(authProvider.notifier).refreshOnboardingStatus();
          _update(latest.copyWith(isSubmitting: false));
          return MerchantSubmitOutcome.alreadyOnboarded;
        }
        _update(latest.copyWith(isSubmitting: false, error: error));
        return MerchantSubmitOutcome.failed;
    }
  }

  static String? _optional(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
}

final merchantSetupProvider =
    AutoDisposeAsyncNotifierProvider<MerchantSetupNotifier, MerchantSetupState>(
  MerchantSetupNotifier.new,
);
