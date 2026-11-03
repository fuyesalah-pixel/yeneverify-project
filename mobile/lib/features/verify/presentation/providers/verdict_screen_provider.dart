import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_result.dart';
import '../../data/models/verification_result.dart';
import '../../data/verify_repository.dart';

/// Loads one verdict by id for the result screen.
///
/// The verdict route is reachable from a deep link as well as from the verify
/// screen, so the screen never trusts a [VerificationResult] passed through
/// `extra` — it always refetches, which also means the receipt row and the
/// duplicate reference are guaranteed to match the stored row.
final verdictScreenProvider =
    AsyncNotifierProvider.family<VerdictScreenNotifier, VerificationResult, String>(
  VerdictScreenNotifier.new,
);

class VerdictScreenNotifier extends FamilyAsyncNotifier<VerificationResult, String> {
  @override
  Future<VerificationResult> build(String verificationId) async {
    final result = await ref.watch(verificationsApiProvider).getById(verificationId);
    return switch (result) {
      Success(:final data) => data,
      Failure(:final error) => throw error,
    };
  }
}
