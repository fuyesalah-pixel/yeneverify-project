// Copy, tone and formatting for the verdict screen.
//
// Kept beside verify_copy.dart so every string the verify feature renders
// lives in one place, and so widget tests can assert against the same
// mapping the screen uses.
import 'package:intl/intl.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../data/models/verification_result.dart';

/// Hero headline for a status.
String verdictHeadline(AppLocalizations l10n, VerificationStatus status) {
  return switch (status) {
    VerificationStatus.verified => l10n.verdictVerifiedLabel,
    VerificationStatus.fake => l10n.verdictFakeLabel,
    VerificationStatus.duplicate => l10n.verdictDuplicateLabel,
    VerificationStatus.needsReview => l10n.verdictReviewLabel,
    VerificationStatus.error => l10n.verdictErrorLabel,
    VerificationStatus.pending => l10n.verdictStillVerifying,
  };
}

/// One line explaining why the status is what it is, or null when there is
/// nothing honest to add.
String? verdictSubtitle(AppLocalizations l10n, VerificationResult result) {
  switch (result.status) {
    case VerificationStatus.verified:
      final name = result.senderName?.trim();
      if (name == null || name.isEmpty) return null;
      return l10n.verdictVerifiedSubtitle(name);
    case VerificationStatus.fake:
      return l10n.verdictFakeSubtitle;
    case VerificationStatus.duplicate:
      final when = result.completedAt ?? result.createdAt;
      return l10n.verdictDuplicateSubtitle(formatVerdictDay(when));
    case VerificationStatus.needsReview:
      return result.needsSupplementary == null
          ? l10n.verdictReviewSubtitle
          : l10n.verdictReviewSupplementarySubtitle;
    case VerificationStatus.error:
      return verdictErrorCopy(l10n, result);
    case VerificationStatus.pending:
      return null;
  }
}

/// Localized explanation for a failed verification.
///
/// The backend's own `errorMessage` is English-only, so it is never shown;
/// an unmapped code falls back to the generic line.
String verdictErrorCopy(AppLocalizations l10n, VerificationResult result) {
  switch (result.errorCode) {
    case 'VERIFICATION_BANK_NOT_DETECTED':
      return l10n.verdictErrorBankNotDetected;
    case 'VERIFICATION_TIMEOUT':
      return l10n.verdictErrorBankTimeout;
    case 'VERIFICATION_BANK_UNAVAILABLE':
    case 'BANK_UNAVAILABLE':
      return l10n.verdictErrorBankUnavailable;
    case 'VERIFICATION_OCR_EMPTY':
    case 'OCR_EMPTY':
      return l10n.verdictErrorOcrEmpty;
    default:
      return l10n.verdictErrorDefault;
  }
}

/// `CBE` → "Commercial Bank of Ethiopia". Unknown codes fall through as-is
/// so a new bank never renders as an empty row.
String? bankDisplayName(AppLocalizations l10n, String? bankCode) {
  switch (bankCode?.toUpperCase()) {
    case 'CBE':
      return l10n.bankCbe;
    case 'TELEBIRR':
      return l10n.bankTelebirr;
    case 'AWASH':
      return l10n.bankAwash;
    case 'DASHEN':
      return l10n.bankDashen;
    case 'ABYSSINIA':
    case 'BOA':
      return l10n.bankAbyssinia;
    case 'MPESA':
    case 'M-PESA':
      return l10n.bankMpesa;
    case 'ZEMEN':
      return l10n.bankZemen;
    default:
      return bankCode;
  }
}

/// "14 Jul 2026"
String formatVerdictDay(DateTime? value) {
  if (value == null) return '—';
  return DateFormat('d MMM yyyy').format(value.toLocal());
}

/// "14 Jul 2026, 2:08 PM"
String formatVerdictTimestamp(DateTime? value) {
  if (value == null) return '—';
  return DateFormat('d MMM yyyy, h:mm a').format(value.toLocal());
}

/// "3.8 seconds"
String verdictDurationText(AppLocalizations l10n, int? durationMs) {
  if (durationMs == null || durationMs <= 0) return '—';
  return l10n.verdictDurationSeconds((durationMs / 1000).toStringAsFixed(1));
}
