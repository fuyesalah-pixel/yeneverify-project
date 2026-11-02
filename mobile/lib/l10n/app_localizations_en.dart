// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'Yene Verify';

  @override
  String get loginTitle => 'Yene Verify';

  @override
  String get loginSubtitle => 'Enter your phone number to get started';

  @override
  String get taglinePrimary => 'Verify any Ethiopian bank payment. In seconds.';

  @override
  String get taglineShort => 'Verify. Trust. Grow.';

  @override
  String get continueLabel => 'Continue';

  @override
  String get cancelLabel => 'Cancel';

  @override
  String get confirmLabel => 'Confirm';

  @override
  String get saveLabel => 'Save';

  @override
  String get deleteLabel => 'Delete';

  @override
  String get retryLabel => 'Try again';

  @override
  String get okLabel => 'OK';

  @override
  String get closeLabel => 'Close';

  @override
  String get backLabel => 'Back';

  @override
  String get doneLabel => 'Done';

  @override
  String get loadingLabel => 'Loading…';

  @override
  String get requiredField => 'This field is required';

  @override
  String get genericError => 'Something went wrong. Please try again.';

  @override
  String get networkError =>
      'No internet connection. Please check your network.';

  @override
  String get sessionExpired => 'Your session has expired. Please log in again.';

  @override
  String get phoneNumber => 'Phone number';

  @override
  String get phoneHint => '+251 9XX XXX XXX';

  @override
  String get phoneInvalid => 'Enter a valid Ethiopian phone number';

  @override
  String get otpTitle => 'Enter verification code';

  @override
  String otpSubtitle(String phone) {
    return 'We sent a 6-digit code to $phone';
  }

  @override
  String get otpResend => 'Resend code';

  @override
  String otpResendIn(int seconds) {
    return 'Resend in ${seconds}s';
  }

  @override
  String get otpInvalid => 'Incorrect code. Try again.';

  @override
  String get otpExpired => 'Code has expired. Request a new one.';

  @override
  String get pinIncorrect => 'Incorrect PIN. Try again.';

  @override
  String pinLocked(int minutes) {
    return 'Too many attempts. Try again in $minutes minutes.';
  }

  @override
  String get errorDeviceLimit => 'Too many devices. Remove one from settings.';

  @override
  String get errorAccountBanned =>
      'This account has been suspended. Contact support.';

  @override
  String get pinSetupTitle => 'Create your PIN';

  @override
  String get pinSetupSubtitle =>
      'You\'ll use this every time you open Yene Verify';

  @override
  String get pinEntryTitle => 'Welcome back';

  @override
  String get pinEntryForgot => 'Forgot PIN?';

  @override
  String get otpMaxAttempts =>
      'Too many attempts. Please wait before trying again.';

  @override
  String get pinTitle => 'Set your PIN';

  @override
  String pinSubtitle(int length) {
    return 'Choose a $length-digit PIN to secure your account';
  }

  @override
  String get pinConfirmTitle => 'Confirm your PIN';

  @override
  String get pinMismatch => 'PINs don\'t match. Try again.';

  @override
  String pinWrong(int attemptsLeft) {
    return 'Incorrect PIN. $attemptsLeft attempts left.';
  }

  @override
  String get enterPin => 'Enter your PIN';

  @override
  String get biometricTitle => 'Enable biometric unlock';

  @override
  String get biometricSubtitle =>
      'Use fingerprint or Face ID to unlock quickly and securely.';

  @override
  String get biometricEnable => 'Enable biometrics';

  @override
  String get biometricSkip => 'Skip for now';

  @override
  String get biometricPrompt => 'Verify your identity';

  @override
  String get biometricFailed =>
      'Biometric authentication failed. Use your PIN.';

  @override
  String get verifyTitle => 'Verify Payment';

  @override
  String get verifySubtitle =>
      'Take or upload a photo of the customer\'s payment confirmation.';

  @override
  String get takePhoto => 'Take Photo';

  @override
  String get uploadImage => 'Upload Image';

  @override
  String get choosePhotoSource => 'Add receipt photo';

  @override
  String get takePhotoDescription => 'Capture the payment confirmation screen';

  @override
  String get uploadImageDescription =>
      'Choose an existing photo from your gallery';

  @override
  String get verificationPending => 'Verifying…';

  @override
  String verificationPendingDetail(String bank) {
    return 'Checking the receipt with $bank. This usually takes under 10 seconds.';
  }

  @override
  String get verdictVerified => 'VERIFIED';

  @override
  String get verdictFake => 'FAKE';

  @override
  String get verdictDuplicate => 'DUPLICATE';

  @override
  String get verdictPending => 'PENDING';

  @override
  String get verdictNeedsReview => 'REVIEW';

  @override
  String get verdictError => 'ERROR';

  @override
  String get verdictVerifiedMessage => 'This receipt is genuine and verified.';

  @override
  String get verdictFakeMessage =>
      'This receipt could not be verified. It may be fake.';

  @override
  String verdictDuplicateMessage(String date) {
    return 'This receipt has already been verified on $date.';
  }

  @override
  String verdictErrorMessage(String bank) {
    return 'Could not reach $bank at this time. Please try again.';
  }

  @override
  String get transactionReference => 'Transaction Reference';

  @override
  String get transactionAmount => 'Amount';

  @override
  String get transactionDate => 'Date';

  @override
  String get transactionBank => 'Bank';

  @override
  String get transactionSender => 'Sender';

  @override
  String get transactionReceiver => 'Receiver';

  @override
  String get transactionsTitle => 'Transactions';

  @override
  String get noTransactionsTitle => 'No verifications yet';

  @override
  String get noTransactionsBody => 'Verified payments will appear here.';

  @override
  String get verifyFirst => 'Verify a payment';

  @override
  String get homeTitle => 'Home';

  @override
  String get analyticsTitle => 'Analytics';

  @override
  String get profileTitle => 'Profile';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get historyTitle => 'History';

  @override
  String get subMerchantsTitle => 'Team';

  @override
  String get addSubMerchant => 'Add team member';

  @override
  String get noSubMerchantsTitle => 'No team members yet';

  @override
  String get noSubMerchantsBody =>
      'Add cashiers or branch staff to verify payments on your behalf.';

  @override
  String creditsRemaining(int count) {
    return '$count credits remaining';
  }

  @override
  String creditsLow(int count) {
    return 'Only $count credits left. Renew your package.';
  }

  @override
  String get creditsEmpty =>
      'Please renew your package to continue verifying receipts.';

  @override
  String get creditsUnlimited => 'Unlimited';

  @override
  String get renewPackage => 'Renew package';

  @override
  String get billingTitle => 'Subscription';

  @override
  String get billingCurrentPlan => 'Current plan';

  @override
  String billingPaymentInstructions(String amount) {
    return 'Transfer $amount to the account below, then upload your payment screenshot.';
  }

  @override
  String get billingUploadProof => 'Upload payment proof';

  @override
  String get billingVerifying => 'Verifying your payment…';

  @override
  String get billingSuccess => 'Payment verified. Your plan is now active.';

  @override
  String get billingFailed =>
      'Payment could not be verified. Please contact support.';

  @override
  String get billingNeedsReview =>
      'Your payment is under review. We\'ll notify you shortly.';

  @override
  String get planFree => 'Free';

  @override
  String get planPremium => 'Premium';

  @override
  String get planBusiness => 'Business';

  @override
  String get planBusinessPro => 'Business Pro';

  @override
  String get planApiIntegration => 'API Integration';

  @override
  String planVerificationsPerMonth(int count) {
    return '$count verifications / month';
  }

  @override
  String get planUnlimitedVerifications => 'Unlimited verifications';

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get noNotificationsTitle => 'All caught up';

  @override
  String get noNotificationsBody => 'You have no new notifications.';

  @override
  String get logoutLabel => 'Log out';

  @override
  String get logoutConfirmTitle => 'Log out?';

  @override
  String get logoutConfirmBody =>
      'You will need to verify your identity to log back in.';

  @override
  String get devicesTitle => 'Trusted devices';

  @override
  String get deviceThisDevice => 'This device';

  @override
  String get deviceRevoke => 'Remove device';

  @override
  String get deviceRevokeConfirm =>
      'Remove this device? You will need to re-authenticate on it.';

  @override
  String get businessName => 'Business name';

  @override
  String get businessType => 'Business type';

  @override
  String get fullName => 'Full name';

  @override
  String get language => 'Language';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageAmharic => 'አማርኛ';

  @override
  String get darkMode => 'Dark mode';

  @override
  String appVersion(String version) {
    return 'Version $version';
  }

  @override
  String get copyReference => 'Copy reference';

  @override
  String get copied => 'Copied!';

  @override
  String get shareLabel => 'Share';

  @override
  String get exportLabel => 'Export';

  @override
  String get filterLabel => 'Filter';

  @override
  String get searchLabel => 'Search';

  @override
  String get searchHint => 'Search transactions…';

  @override
  String noSearchResults(String query) {
    return 'No results for \"$query\"';
  }

  @override
  String get dateRangeLabel => 'Date range';

  @override
  String get bankLabel => 'Bank';

  @override
  String get allBanks => 'All banks';

  @override
  String get bankCbe => 'Commercial Bank of Ethiopia';

  @override
  String get bankTelebirr => 'Telebirr';

  @override
  String get bankAwash => 'Awash Bank';

  @override
  String get bankDashen => 'Dashen Bank';

  @override
  String get bankAbyssinia => 'Bank of Abyssinia';

  @override
  String get bankMpesa => 'M-Pesa';

  @override
  String get bankZemen => 'Zemen Bank';

  @override
  String get insightsTitle => 'Insights';

  @override
  String get insightBestProducts => 'Best selling products';

  @override
  String get insightPeakHours => 'Peak hours';

  @override
  String get insightBestDays => 'Best days';

  @override
  String get insightTrend => 'Trend';

  @override
  String get insightRecommendations => 'Recommendations';

  @override
  String get insightAnomalies => 'Anomalies';

  @override
  String get noInsightsTitle => 'Not enough data yet';

  @override
  String get noInsightsBody =>
      'Complete more verifications to unlock insights.';

  @override
  String trendUp(String percent, String period) {
    return '+$percent% vs last $period';
  }

  @override
  String trendDown(String percent, String period) {
    return '-$percent% vs last $period';
  }

  @override
  String get periodWeek => 'week';

  @override
  String get periodMonth => 'month';

  @override
  String get auditLogTitle => 'Audit log';

  @override
  String get permissionCameraTitle => 'Camera access needed';

  @override
  String get permissionCameraBody =>
      'Yene Verify needs camera access to capture payment screenshots.';

  @override
  String get permissionGalleryTitle => 'Photo library access needed';

  @override
  String get permissionGalleryBody =>
      'Yene Verify needs photo library access to upload payment screenshots.';

  @override
  String get permissionOpenSettings => 'Open settings';

  @override
  String get onboardingStep1Title => 'Verify payments instantly';

  @override
  String get onboardingStep1Body =>
      'Take a photo of any Ethiopian bank receipt and get a verified result in under 10 seconds.';

  @override
  String get onboardingStep2Title => 'Stop payment fraud';

  @override
  String get onboardingStep2Body =>
      'Duplicate receipt detection protects your business from the same receipt being used twice.';

  @override
  String get onboardingStep3Title => 'Grow with insights';

  @override
  String get onboardingStep3Body =>
      'Understand your peak hours, best products, and sales trends — all from your verified transactions.';

  @override
  String get getStarted => 'Get started';

  @override
  String get learnMoreLabel => 'Learn more';

  @override
  String get authComingSoon => 'Auth flow — coming Step 21';

  @override
  String get debugDesignSystem => 'Debug: Design System';
}
