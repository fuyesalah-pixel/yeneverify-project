// Maps canonical backend error codes (shared/contracts/error-codes.json)
// plus the small set of client-side codes to localized copy.
//
// Kept out of the controller because the controller has no BuildContext and
// must not hardcode English UI strings beyond its log/fallback message.
import 'package:yene_verify/l10n/app_localizations.dart';

import '../data/models/verification_result.dart';

String verifyErrorMessage(AppLocalizations l10n, String code) {
  switch (code) {
    case 'RECEIPT_TOO_LARGE':
      return l10n.errorImageTooLarge;
    case 'RECEIPT_INVALID_TYPE':
      return l10n.errorInvalidImageType;
    case 'RECEIPT_HASH_MISMATCH':
      return l10n.errorUploadMismatch;
    case 'RECEIPT_NOT_UPLOADED':
      return l10n.errorUploadIncomplete;
    case 'CREDITS_EXHAUSTED':
      return l10n.errorCreditsExhausted;
    case 'VERIFICATION_BANK_NOT_DETECTED':
      return l10n.errorBankNotDetected;
    case 'VERIFICATION_TIMEOUT':
      return l10n.verifyTooLong;
    case 'NETWORK_ERROR':
      return l10n.networkError;
    case 'PHOTOS_PERMISSION_DENIED':
      return l10n.photoAccessBody;
    case 'GALLERY_UNAVAILABLE':
      return l10n.galleryUnavailable;
    default:
      return l10n.genericError;
  }
}

String verificationStatusLabel(AppLocalizations l10n, VerificationStatus status) {
  switch (status) {
    case VerificationStatus.pending:
      return l10n.statusPending;
    case VerificationStatus.verified:
      return l10n.statusVerified;
    case VerificationStatus.fake:
      return l10n.statusFake;
    case VerificationStatus.duplicate:
      return l10n.statusDuplicate;
    case VerificationStatus.needsReview:
      return l10n.statusNeedsReview;
    case VerificationStatus.error:
      return l10n.statusError;
  }
}
