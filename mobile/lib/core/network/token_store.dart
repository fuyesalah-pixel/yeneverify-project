import 'package:flutter_riverpod/flutter_riverpod.dart';

/// # InMemoryTokenStore
///
/// The access token lives here and only here — never on disk. Cleared on
/// logout, on app kill (memory), or when refresh fails.
class InMemoryTokenStore {
  String? accessToken;

  String? get accessTokenOrNull => accessToken;

  bool get hasToken => accessToken != null;

  void set(String token) => accessToken = token;

  void clear() => accessToken = null;

  @override
  String toString() =>
      hasToken ? 'InMemoryTokenStore(accessToken: ●●●)' : 'InMemoryTokenStore(empty)';
}

/// Routes between the in-memory store and the secure storage facade without
/// creating an import cycle: the network layer stores/reads through
/// callbacks installed by the repository layer at boot.
class TokenGateway {
  String? Function() readRefreshToken = () => null;
  Future<void> Function(String token) writeRefreshToken = (_) async {};
  Future<void> Function() clear = () async {};
  void Function()? onSessionExpired;
}

final inMemoryTokenStoreProvider =
    Provider<InMemoryTokenStore>((ref) => InMemoryTokenStore());

final tokenGatewayProvider = Provider<TokenGateway>((ref) => TokenGateway());
