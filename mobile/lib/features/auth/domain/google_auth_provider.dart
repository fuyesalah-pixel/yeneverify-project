// Riverpod provider for Google Sign-In flow.
//
// State machine:
//   idle -> signingIn -> (linked → unlocked) | (notLinked → phonePairing) | error
//
// The pairing step collects phone + fullName and calls POST /auth/google/onboard.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import '../data/auth_repository.dart';
import '../data/google_auth_api.dart';
import '../data/models/auth_models.dart';
import '../data/models/device_account.dart';
import '../domain/auth_notifier.dart';

enum GoogleAuthStatus {
  idle,
  signingIn,
  pairingPhone,
  paired,
  error,
}

class GoogleAuthState {
  const GoogleAuthState({
    this.status = GoogleAuthStatus.idle,
    this.error,
    this.deviceAccounts = const <DeviceAccount>[],
    this.requiresPairing = false,
    this.googleAccount,
  });

  final GoogleAuthStatus status;
  final ApiError? error;
  final List<DeviceAccount> deviceAccounts;
  final bool requiresPairing;
  final GoogleSignInAccount? googleAccount;

  GoogleAuthState copyWith({
    GoogleAuthStatus? status,
    ApiError? error,
    List<DeviceAccount>? deviceAccounts,
    bool? requiresPairing,
    GoogleSignInAccount? googleAccount,
    bool clearError = false,
  }) =>
      GoogleAuthState(
        status: status ?? this.status,
        error: clearError ? null : (error ?? this.error),
        deviceAccounts: deviceAccounts ?? this.deviceAccounts,
        requiresPairing: requiresPairing ?? this.requiresPairing,
        googleAccount: googleAccount ?? this.googleAccount,
      );
}

class GoogleAuthNotifier extends Notifier<GoogleAuthState> {
  GoogleAuthApi get api => ref.read(googleAuthApiProvider);
  AuthRepository get repo => ref.read(authRepositoryProvider);
  AuthNotifier get authNotifier => ref.read(authProvider.notifier);

  final _googleSignIn = GoogleSignIn(
    scopes: <String>['email', 'profile'],
    serverClientId: const String.fromEnvironment(
      'GOOGLE_WEB_CLIENT_ID',
      defaultValue: '',
    ),
  );

  @override
  GoogleAuthState build() => const GoogleAuthState();

  /// Initialize: list paired devices for this fingerprint.
  Future<void> init() async {
    try {
      state = state.copyWith(status: GoogleAuthStatus.idle);
      final fp = await repo.getOrCreateFingerprint();
      final result = await api.deviceAccounts(deviceFingerprint: fp);
      switch (result) {
        case Success<List<DeviceAccount>>():
          state = state.copyWith(
            deviceAccounts: result.data,
            status: GoogleAuthStatus.idle,
          );
        case Failure<List<DeviceAccount>>():
          state = state.copyWith(
            error: result.error,
            status: GoogleAuthStatus.idle,
          );
      }
    } catch (e) {
      state = state.copyWith(
        error: ApiError(message: e.toString()),
        status: GoogleAuthStatus.idle,
      );
    }
  }

  /// Start Google Sign-In. Returns the GoogleSignInAccount on success.
  Future<GoogleSignInAccount?> signInWithGoogle() async {
    state = state.copyWith(
      status: GoogleAuthStatus.signingIn,
      clearError: true,
    );

    try {
      await _googleSignIn.signOut();

      final account = await _googleSignIn.signIn();
      if (account == null) {
        state = state.copyWith(
          status: GoogleAuthStatus.idle,
          error: const ApiError(code: 'AUTH_GOOGLE_CANCELLED'),
        );
        return null;
      }

      final authentication = await account.authentication;
      final idToken = authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        state = state.copyWith(
          status: GoogleAuthStatus.idle,
          error: const ApiError(code: 'AUTH_GOOGLE_NO_TOKEN'),
        );
        return null;
      }

      state = state.copyWith(
        googleAccount: account,
        requiresPairing: false,
      );

      // Try signin first (returning Google user).
      final device = await _deviceInfo();
      final result = await api.signin(idToken: idToken, device: device);

      switch (result) {
        case Success<AuthResponse>():
          await _completeAuth(result.data);
          return account;
        case Failure<AuthResponse>():
          final code = result.error.code;
          if (code == 'AUTH_GOOGLE_ALREADY_PAIRED' ||
              code == 'AUTH_PHONE_ALREADY_PAIRED' ||
              code == 'AUTH_DEVICE_LIMIT_PAIRS') {
            state = state.copyWith(
              status: GoogleAuthStatus.error,
              error: result.error,
            );
            return account;
          }
          state = state.copyWith(
            status: GoogleAuthStatus.pairingPhone,
            requiresPairing: true,
          );
          return account;
      }
    } catch (e) {
      state = state.copyWith(
        status: GoogleAuthStatus.idle,
        error: ApiError(message: e.toString()),
      );
      return null;
    }
  }

  /// Complete pairing: POST /auth/google/onboard with phone + fullName.
  Future<bool> pairPhone({
    required String phone,
    required String fullName,
  }) async {
    if (state.googleAccount == null) {
      state = state.copyWith(
        status: GoogleAuthStatus.error,
        error: const ApiError(code: 'AUTH_GOOGLE_NO_ACCOUNT'),
      );
      return false;
    }

    state = state.copyWith(
      status: GoogleAuthStatus.signingIn,
      clearError: true,
    );

    try {
      final authentication = await state.googleAccount!.authentication;
      final idToken = authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        state = state.copyWith(
          status: GoogleAuthStatus.error,
          error: const ApiError(code: 'AUTH_GOOGLE_NO_TOKEN'),
        );
        return false;
      }

      final device = await _deviceInfo();
      final result = await api.onboard(
        idToken: idToken,
        phone: phone,
        fullName: fullName,
        device: device,
      );

      switch (result) {
        case Success<AuthResponse>():
          await _completeAuth(result.data);
          return true;
        case Failure<AuthResponse>():
          state = state.copyWith(
            status: GoogleAuthStatus.error,
            error: result.error,
          );
          return false;
      }
    } catch (e) {
      state = state.copyWith(
        status: GoogleAuthStatus.error,
        error: ApiError(message: e.toString()),
      );
      return false;
    }
  }

  /// Load device accounts for the current fingerprint.
  Future<void> loadDeviceAccounts() async {
    final fp = await repo.getOrCreateFingerprint();
    final result = await api.deviceAccounts(deviceFingerprint: fp);
    switch (result) {
      case Success<List<DeviceAccount>>():
        state = state.copyWith(deviceAccounts: result.data);
      case Failure<List<DeviceAccount>>():
        state = state.copyWith(error: result.error);
    }
  }

  /// Sign out a specific device account (by phone last-4).
  Future<bool> signoutDeviceAccount({
    required String phoneLast4,
  }) async {
    final fp = await repo.getOrCreateFingerprint();
    final result = await api.signoutDeviceAccount(
      phoneLast4: phoneLast4,
      deviceFingerprint: fp,
    );
    switch (result) {
      case Success<void>():
        await loadDeviceAccounts();
        return true;
      case Failure<void>():
        state = state.copyWith(error: result.error);
        return false;
    }
  }

  Future<void> _completeAuth(AuthResponse response) async {
    final sessionResult = await repo.verifyOtpGoogle(
      tokens: response.tokens,
      user: response.user,
    );
    switch (sessionResult) {
      case Success<AuthStateResult>():
        authNotifier.setGoogleSession(
          user: response.user,
          tokens: response.tokens,
        );
        state = state.copyWith(
          status: GoogleAuthStatus.paired,
          requiresPairing: false,
        );
      case Failure<AuthStateResult>():
        state = state.copyWith(
          status: GoogleAuthStatus.error,
          error: sessionResult.error,
        );
    }
  }

  Future<Map<String, dynamic>> _deviceInfo() async {
    final fingerprint = await repo.getOrCreateFingerprint();
    return {
      'fingerprint': fingerprint,
      'platform': 'ANDROID',
    };
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }
}

final googleAuthProvider =
    NotifierProvider<GoogleAuthNotifier, GoogleAuthState>(GoogleAuthNotifier.new);
