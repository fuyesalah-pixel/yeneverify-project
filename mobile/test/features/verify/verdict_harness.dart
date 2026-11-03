import 'package:flutter/material.dart';
import 'package:yene_verify/core/theme/app_colors.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

/// Wraps a verdict widget with the real theme tokens and the real l10n
/// delegates, so tests assert against the same copy the app renders.
Widget verdictTestApp(Widget child) {
  return MaterialApp(
    theme: ThemeData(
      useMaterial3: true,
      extensions: const <ThemeExtension<dynamic>>[AppColors.light],
    ),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}

/// A fully-populated VERIFIED result; other statuses differ only in the
/// fields that status actually carries.
VerificationResult sampleVerdict({
  VerificationStatus status = VerificationStatus.verified,
  String? errorCode,
  bool withSupplementary = true,
}) {
  return VerificationResult(
    id: 'v-123456789',
    status: status,
    source: 'TRANSACTION',
    bankCode: 'CBE',
    bankReference: 'FT23170ABC',
    amountMinor: '550000',
    senderName: 'Abebe Kebede',
    receiverName: 'Diag Mart',
    paidAt: DateTime(2026, 7, 14, 14, 8),
    errorCode: errorCode,
    durationMs: 3800,
    duplicateOf: status == VerificationStatus.duplicate
        ? const DuplicateReference(
            verificationId: 'v-original-9',
            merchantId: 'm-1',
          )
        : null,
    needsSupplementary:
        status == VerificationStatus.needsReview && withSupplementary
            ? const SupplementaryPrompt(
                field: 'accountSuffix',
                hint: 'Last 4 digits of the receiving account',
              )
            : null,
    receiptId: 'r-1',
    receiptMimeType: 'image/jpeg',
    createdAt: DateTime(2026, 7, 14, 14, 8),
    completedAt: DateTime(2026, 7, 14, 14, 8, 3),
  );
}
