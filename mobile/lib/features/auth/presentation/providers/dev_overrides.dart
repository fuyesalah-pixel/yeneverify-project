// Debug-only dev helpers (Step 21 spec). Every entrypoint is guarded by
// kDebugMode; the compiler tree-shakes the call sites in release builds.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/storage/secure_storage.dart';
import '../../data/models/auth_models.dart';
import '../../domain/auth_notifier.dart';

/// Clears all auth-related values and returns to the login screen. Debug only.
Future<void> devResetAuth(WidgetRef ref) async {
  if (!kDebugMode) return;
  await ref.read(sessionStoreProvider).wipe();
  await ref.read(authProvider.notifier).logout();
}

/// Sets the auth state to unlocked with a fake user so Steps 22-27 can be
/// developed without going through OTP each time. Debug + in-memory only.
void devSkipAuth(WidgetRef ref) {
  if (!kDebugMode) return;
  const fakeUser = User(
    id: 'dev-user-id',
    phone: '+251911555001',
    fullName: 'Dev User',
    role: 'MERCHANT',
    status: 'ACTIVE',
    needsPinSetup: false,
    needsOnboarding: false,
  );
  ref.read(authProvider.notifier).devUnlock(user: fakeUser);
}
