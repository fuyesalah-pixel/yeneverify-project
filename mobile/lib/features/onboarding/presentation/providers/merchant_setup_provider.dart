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
    this.showAccounts = false,
    this.cbeEnabled = false,
    this.cbeLast8 = '',
    this.abyssiniaEnabled = false,
    this.abyssiniaLast5 = '',
    this.awashEnabled = false,
    this.awashAccountNumber = '',
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
  final bool showAccounts;
  final bool cbeEnabled;
  final String cbeLast8;
  final bool abyssiniaEnabled;
  final String abyssiniaLast5;
  final bool awashEnabled;
  final String awashAccountNumber;
  final ApiError? error;
  final BusinessNameError? businessNameError;
  final CreateMerchantResponse? merchant;

  bool get isBusinessNameValid => validateBusinessName(businessName) == null;

  bool get isCbeValid =>
      !cbeEnabled || RegExp(r'^\d{8}$').hasMatch(cbeLast8.trim());
  bool get isAbyssiniaValid =>
      !abyssiniaEnabled || RegExp(r'^\d{5}$').hasMatch(abyssiniaLast5.trim());
  bool get isAwashValid =>
      !awashEnabled ||
      RegExp(r'^\d{10,16}$').hasMatch(awashAccountNumber.trim());

  bool get areAccountsValid => isCbeValid && isAbyssiniaValid && isAwashValid;

  /// Only checked banks travel to the backend; unchecked banks stay absent.
  Map<String, dynamic>? get verificationAccountsPatch {
    final patch = <String, dynamic>{};
    if (cbeEnabled) patch['cbe'] = {'last8': cbeLast8.trim()};
    if (abyssiniaEnabled) patch['abyssinia'] = {'last5': abyssiniaLast5.trim()};
    if (awashEnabled) patch['awash'] = {'accountNumber': awashAccountNumber.trim()};
    return patch.isEmpty ? null : patch;
  }

  MerchantSetupState copyWith({
    String? businessName,
    BusinessType? businessType,
    String? tin,
    String? address,
    String? city,
    bool? isSubmitting,
    bool? showDetails,
    bool? showAccounts,
    bool? cbeEnabled,
    String? cbeLast8,
    bool? abyssiniaEnabled,
    String? abyssiniaLast5,
    bool? awashEnabled,
    String? awashAccountNumber,
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
      showAccounts: showAccounts ?? this.showAccounts,
      cbeEnabled: cbeEnabled ?? this.cbeEnabled,
      cbeLast8: cbeLast8 ?? this.cbeLast8,
      abyssiniaEnabled: abyssiniaEnabled ?? this.abyssiniaEnabled,
      abyssiniaLast5: abyssiniaLast5 ?? this.abyssiniaLast5,
      awashEnabled: awashEnabled ?? this.awashEnabled,
      awashAccountNumber: awashAccountNumber ?? this.awashAccountNumber,
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

  void toggleAccounts() {
    final current = _current;
    if (current == null) return;
    _update(current.copyWith(showAccounts: !current.showAccounts));
  }

  void setCbeEnabled(bool value) {
    final current = _current;
    if (current == null) return;
    _update(current.copyWith(cbeEnabled: value));
  }

  void setCbeLast8(String value) {
    final current = _current;
    if (current == null) return;
    _update(current.copyWith(cbeLast8: value));
  }

  void setAbyssiniaEnabled(bool value) {
    final current = _current;
    if (current == null) return;
    _update(current.copyWith(abyssiniaEnabled: value));
  }

  void setAbyssiniaLast5(String value) {
    final current = _current;
    if (current == null) return;
    _update(current.copyWith(abyssiniaLast5: value));
  }

  void setAwashEnabled(bool value) {
    final current = _current;
    if (current == null) return;
    _update(current.copyWith(awashEnabled: value));
  }

  void setAwashAccountNumber(String value) {
    final current = _current;
    if (current == null) return;
    _update(current.copyWith(awashAccountNumber: value));
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
    if (!current.areAccountsValid) {
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
            verificationAccounts: current.verificationAccountsPatch,
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
