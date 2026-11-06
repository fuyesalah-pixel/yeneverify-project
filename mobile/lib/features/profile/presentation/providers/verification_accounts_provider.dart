import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_result.dart';
import '../../data/models/verification_accounts.dart';
import '../../data/verification_accounts_api.dart';

/// Current merchant verification accounts. Invalidated after a successful
/// save so Profile and the verdict screen see fresh values.
final verificationAccountsProvider =
    FutureProvider.autoDispose<VerificationAccounts>((ref) async {
  final result = await ref.watch(verificationAccountsApiProvider).get();
  return switch (result) {
    Success<VerificationAccounts>(:final data) => data,
    Failure<VerificationAccounts>(:final error) => throw error,
  };
});
