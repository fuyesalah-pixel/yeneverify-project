// Sub-merchant invite accept/decline state (Step 22A).
//
// The invite token is NOT in /onboarding/status (the backend only exposes the
// invite id); it arrives separately as a signed JWT. MVP: the user pastes it
// from the SMS. Deep links are backlog.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/network/api_result.dart';
import '../../data/models/create_merchant_response.dart';
import '../../data/onboarding_repository.dart';

class InviteState {
  const InviteState({
    this.inviteToken = '',
    this.isAccepting = false,
    this.isDeclining = false,
    this.error,
  });

  final String inviteToken;
  final bool isAccepting;
  final bool isDeclining;
  final ApiError? error;

  bool get isBusy => isAccepting || isDeclining;

  InviteState copyWith({
    String? inviteToken,
    bool? isAccepting,
    bool? isDeclining,
    ApiError? error,
    bool clearError = false,
  }) {
    return InviteState(
      inviteToken: inviteToken ?? this.inviteToken,
      isAccepting: isAccepting ?? this.isAccepting,
      isDeclining: isDeclining ?? this.isDeclining,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class InviteNotifier extends AutoDisposeAsyncNotifier<InviteState> {
  @override
  Future<InviteState> build() async => const InviteState();

  InviteState? get _current => state.valueOrNull;

  void _update(InviteState next) => state = AsyncData(next);

  void updateToken(String value) {
    final current = _current;
    if (current == null) return;
    _update(current.copyWith(inviteToken: value, clearError: true));
  }

  /// Returns null on success, the typed error otherwise.
  Future<ApiError?> accept() async {
    final current = _current;
    if (current == null || current.isBusy) return null;

    final token = current.inviteToken.trim();
    if (token.isEmpty) {
      const error = ApiError(
        code: 'AUTH_INVITE_INVALID',
        message: 'Enter the invite code from your SMS.',
      );
      _update(current.copyWith(error: error));
      return error;
    }

    _update(current.copyWith(
      inviteToken: token,
      isAccepting: true,
      clearError: true,
    ));

    final result =
        await ref.read(onboardingRepositoryProvider).acceptInvite(token);
    final latest = _current ?? current;

    switch (result) {
      case Success<AcceptInviteResponse>():
        _update(latest.copyWith(isAccepting: false));
        return null;
      case Failure<AcceptInviteResponse>(:final error):
        _update(latest.copyWith(isAccepting: false, error: error));
        return error;
    }
  }

  /// Returns null on success, the typed error otherwise.
  Future<ApiError?> decline() async {
    final current = _current;
    if (current == null || current.isBusy) return null;

    final token = current.inviteToken.trim();
    if (token.isEmpty) {
      const error = ApiError(
        code: 'AUTH_INVITE_INVALID',
        message: 'Enter the invite code from your SMS.',
      );
      _update(current.copyWith(error: error));
      return error;
    }

    _update(current.copyWith(
      inviteToken: token,
      isDeclining: true,
      clearError: true,
    ));

    final result =
        await ref.read(onboardingRepositoryProvider).declineInvite(token);
    final latest = _current ?? current;

    switch (result) {
      case Success<bool>():
        _update(latest.copyWith(isDeclining: false));
        return null;
      case Failure<bool>(:final error):
        _update(latest.copyWith(isDeclining: false, error: error));
        return error;
    }
  }
}

final inviteProvider =
    AutoDisposeAsyncNotifierProvider<InviteNotifier, InviteState>(
  InviteNotifier.new,
);
