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
  String get authWeakPin =>
      'PIN is too weak. Use 4 or 6 digits, avoid sequential or repeated numbers.';

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
  String get onboardingMerchantTitle => 'Let\'s set up your business';

  @override
  String get onboardingMerchantSubtitle =>
      'We\'ll use this to personalize your Yene Verify experience';

  @override
  String get businessNameHint => 'e.g., Selam Coffee, Addis Electronics';

  @override
  String get businessNameRequired => 'Enter your business name';

  @override
  String get businessNameTooShort =>
      'Business name must be at least 2 characters';

  @override
  String get businessNameTooLong =>
      'Business name must be 80 characters or less';

  @override
  String get addMoreDetails => 'Add more details';

  @override
  String get businessTypeCafe => 'Cafe';

  @override
  String get businessTypeRestaurant => 'Restaurant';

  @override
  String get businessTypeRetail => 'Retail';

  @override
  String get businessTypeServices => 'Services';

  @override
  String get businessTypeOther => 'Other';

  @override
  String get tinLabel => 'TIN (Tax ID)';

  @override
  String get addressLabel => 'Address';

  @override
  String get cityLabel => 'City';

  @override
  String get createBusiness => 'Create business';

  @override
  String get onboardingSuccessTitle => 'You\'re all set';

  @override
  String onboardingSuccessSubtitle(String businessName) {
    return 'Your business $businessName is now on Yene Verify.';
  }

  @override
  String get inviteTitle => 'You\'re invited';

  @override
  String inviteBody(String merchantName) {
    return '$merchantName invited you to join their team';
  }

  @override
  String inviteBranch(String branchLabel) {
    return 'Branch: $branchLabel';
  }

  @override
  String get inviteAbility =>
      'You\'ll be able to verify payments for this business.';

  @override
  String get inviteCodeLabel => 'Enter the code from your SMS';

  @override
  String get inviteCodeHint => 'Paste your invite code';

  @override
  String get acceptInvite => 'Accept invite';

  @override
  String get declineInvite => 'Decline';

  @override
  String get declineInviteConfirmTitle => 'Decline this invite?';

  @override
  String declineInviteConfirmBody(String merchantName) {
    return 'You\'ll need a new invite to join $merchantName.';
  }

  @override
  String inviteExpired(String merchantName) {
    return 'This invite has expired. Ask $merchantName for a new one.';
  }

  @override
  String get inviteConsumed => 'This invite was already used.';

  @override
  String get inviteInvalid => 'That code doesn\'t match. Check the SMS.';

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

  @override
  String get verifyHeading => 'Verify a payment';

  @override
  String get verifyHeadingSubtitle =>
      'Upload or photograph the customer\'s bank confirmation to verify it in seconds.';

  @override
  String get takePhotoCardSubtitle => 'Use your camera to capture the receipt';

  @override
  String get uploadImageCardSubtitle => 'Choose a screenshot from your gallery';

  @override
  String verificationsRemaining(int count) {
    return 'You have $count verifications remaining.';
  }

  @override
  String get unlimitedVerifications => 'Unlimited verifications';

  @override
  String get preparingImage => 'Preparing image…';

  @override
  String uploadingPercent(int percent) {
    return 'Uploading… $percent%';
  }

  @override
  String get verifyTakesSeconds => 'This takes a few seconds…';

  @override
  String get verifyStillWorking => 'Still verifying…';

  @override
  String get verifyPendingBody =>
      'Still verifying — this can take up to a minute for some banks.';

  @override
  String get refreshNow => 'Refresh now';

  @override
  String get checkTransactions => 'Check transactions';

  @override
  String get verifyTooLong =>
      'Verification is taking too long. Check back in a minute.';

  @override
  String get errorImageTooLarge => 'Image too large. Try a smaller screenshot.';

  @override
  String get errorInvalidImageType => 'Invalid image format. Use JPEG or PNG.';

  @override
  String get errorUploadMismatch => 'Upload verification failed. Try again.';

  @override
  String get errorUploadIncomplete =>
      'Upload didn\'t complete. Check your connection.';

  @override
  String get errorCreditsExhausted =>
      'You\'re out of credits. Top up to continue.';

  @override
  String get errorBankNotDetected =>
      'We couldn\'t identify the bank in this receipt. Try a clearer photo.';

  @override
  String get cameraNotAvailable =>
      'Camera not available. Use Upload image instead.';

  @override
  String get cameraAccessNeeded => 'Camera access needed';

  @override
  String get cameraAccessBody =>
      'Allow camera access in your system settings to photograph receipts.';

  @override
  String get photoAccessNeeded => 'Photo access needed';

  @override
  String get photoAccessBody =>
      'Allow photo access in your system settings to pick a receipt image.';

  @override
  String get openSettings => 'Open settings';

  @override
  String get usePhoto => 'Use photo';

  @override
  String get retakePhoto => 'Retake';

  @override
  String get switchCamera => 'Switch camera';

  @override
  String get toggleFlash => 'Toggle flash';

  @override
  String get galleryUnavailable => 'Couldn\'t open your gallery. Try again.';

  @override
  String get verdictTitle => 'Verification result';

  @override
  String get backToVerify => 'Back to verify';

  @override
  String get verdictPlaceholderNote =>
      'Receipt preview, share, and retry arrive in Part 2.';

  @override
  String get statusPending => 'Pending';

  @override
  String get statusVerified => 'Verified';

  @override
  String get statusFake => 'Fake';

  @override
  String get statusDuplicate => 'Duplicate';

  @override
  String get statusNeedsReview => 'Needs review';

  @override
  String get statusError => 'Error';

  @override
  String get viewPlans => 'View plans';

  @override
  String get verdictVerifiedLabel => 'Payment verified';

  @override
  String get verdictFakeLabel => 'Fake receipt';

  @override
  String get verdictDuplicateLabel => 'Already verified';

  @override
  String get verdictReviewLabel => 'Under review';

  @override
  String get verdictErrorLabel => 'Verification failed';

  @override
  String verdictVerifiedSubtitle(String name) {
    return 'Paid by $name';
  }

  @override
  String get verdictFakeSubtitle =>
      'This receipt was not found on the bank\'s server.';

  @override
  String verdictDuplicateSubtitle(String date) {
    return 'This receipt was already verified on $date.';
  }

  @override
  String get verdictReviewSubtitle =>
      'A team member will review this receipt within 24 hours.';

  @override
  String get verdictReviewSupplementarySubtitle =>
      'We need a clearer photo of this receipt to finish verifying it.';

  @override
  String get verdictReviewFixTitle => 'Retake the receipt';

  @override
  String get verdictReviewRetakeHint =>
      'Keep the whole receipt in frame, flat and evenly lit.';

  @override
  String get verdictBankLabel => 'Bank';

  @override
  String get verdictReferenceLabel => 'Reference';

  @override
  String get verdictSenderLabel => 'Sender';

  @override
  String get verdictReceiverLabel => 'Receiver';

  @override
  String get verdictPaidAtLabel => 'Paid at';

  @override
  String get verdictVerifiedAtLabel => 'Verified at';

  @override
  String get verdictDurationLabel => 'Duration';

  @override
  String get verdictFirstVerifiedLabel => 'First verified';

  @override
  String get verdictFirstVerifiedHint => 'Tap to see the original receipt.';

  @override
  String verdictDurationSeconds(String seconds) {
    return '$seconds seconds';
  }

  @override
  String get verdictDoneButton => 'Done';

  @override
  String get verdictTryAgainButton => 'Try again';

  @override
  String get verdictReportButton => 'Report a problem';

  @override
  String get verdictViewOriginalButton => 'View original';

  @override
  String get verdictViewReceiptButton => 'View receipt';

  @override
  String get verdictCopySuccess => 'Reference copied';

  @override
  String get verdictStillVerifying => 'Still verifying…';

  @override
  String get verdictReportTitle => 'Report a problem';

  @override
  String get verdictReportBody =>
      'Tell us what is wrong with this verification. Our team will review it.';

  @override
  String get verdictReportReasonHint => 'What is wrong?';

  @override
  String get verdictReportReasonRequired =>
      'Tell us what is wrong before submitting.';

  @override
  String get verdictReportSubmitButton => 'Submit report';

  @override
  String get verdictReportSubmitted =>
      'Report submitted. We will look into it.';

  @override
  String get verdictCancelButton => 'Cancel';

  @override
  String get verdictReviewNotificationInfo =>
      'You will be notified when the review is complete.';

  @override
  String get verdictReceiptUnavailable => 'Receipt image unavailable';

  @override
  String get verdictReceiptRetry => 'Reload image';

  @override
  String get verdictOriginalUnavailable =>
      'This receipt belongs to another business.';

  @override
  String get verdictErrorBankNotDetected =>
      'We could not identify the bank on this receipt. Try a clearer photo.';

  @override
  String get verdictErrorBankTimeout =>
      'The bank\'s server is slow right now. Try again.';

  @override
  String get verdictErrorBankUnavailable =>
      'The bank is unavailable right now. Try again later.';

  @override
  String get verdictErrorOcrEmpty =>
      'We could not read this receipt. Try a clearer photo.';

  @override
  String get verdictErrorDefault => 'Something went wrong. Try again.';

  @override
  String get verdictConfigureAccount => 'Configure now';

  @override
  String get verdictConfigureAccountTitle => 'Add your bank account details';

  @override
  String get navHome => 'Home';

  @override
  String get navVerify => 'Verify';

  @override
  String get navTransactions => 'Transactions';

  @override
  String get navInsights => 'Insights';

  @override
  String get navProfile => 'Profile';

  @override
  String greetingMorning(String name) {
    return 'Good morning, $name';
  }

  @override
  String greetingAfternoon(String name) {
    return 'Good afternoon, $name';
  }

  @override
  String greetingEvening(String name) {
    return 'Good evening, $name';
  }

  @override
  String get dashboardWelcomeBack => 'Welcome back';

  @override
  String get dashboardBusinessFallback => 'Your business';

  @override
  String dashboardCreditsLeft(int count) {
    return '$count verifications left';
  }

  @override
  String get dashboardUnlimited => 'Unlimited verifications';

  @override
  String get dashboardTopUp => 'Top up';

  @override
  String get dashboardThisMonth => 'This month';

  @override
  String get dashboardVerifications => 'Verifications';

  @override
  String get dashboardRange7 => 'Last 7 days';

  @override
  String get dashboardRange30 => 'Last 30 days';

  @override
  String get dashboardRange90 => 'Last 90 days';

  @override
  String get dashboardRange365 => 'Last 12 months';

  @override
  String get dashboardQuickVerifyTitle => 'Verify a payment';

  @override
  String get dashboardQuickVerifyBody => 'Scan a bank receipt';

  @override
  String get dashboardQuickHistoryTitle => 'Transactions';

  @override
  String get dashboardQuickHistoryBody => 'Every verification in one place';

  @override
  String get dashboardRecentTitle => 'Recent activity';

  @override
  String get dashboardSeeAll => 'See all';

  @override
  String get dashboardEmptyTitle => 'No verifications yet';

  @override
  String get dashboardEmptyBody => 'Verified payments will appear here.';

  @override
  String get dashboardStaleBanner =>
      'Some of this data couldn\'t load. Tap to retry.';

  @override
  String get dashboardErrorBody => 'We couldn\'t load your dashboard.';

  @override
  String get dashboardNotifications => 'Notifications';

  @override
  String get dashboardInboxSoon => 'Your inbox arrives in Step 26.';

  @override
  String get dashboardBillingSoon => 'Billing arrives in Step 25.';

  @override
  String get shellComingSoon => 'Coming soon';

  @override
  String get shellHistoryBody => 'Full transaction history arrives in Step 24.';

  @override
  String get shellInsightsBody => 'Insights arrive in Step 26.';

  @override
  String get shellProfileBody => 'Profile and settings arrive in Step 27.';

  @override
  String get relativeTimeJustNow => 'Just now';

  @override
  String relativeTimeMinutes(int count) {
    return '${count}m ago';
  }

  @override
  String relativeTimeHours(int count) {
    return '${count}h ago';
  }

  @override
  String get relativeTimeYesterday => 'Yesterday';

  @override
  String relativeTimeDays(int count) {
    return '${count}d ago';
  }

  @override
  String get transactionsSearchHint => 'Search reference or amount';

  @override
  String get transactionsFilterTitle => 'Filters';

  @override
  String get transactionsFilterBank => 'Bank';

  @override
  String get transactionsFilterRange => 'Date range';

  @override
  String get transactionsApply => 'Apply';

  @override
  String get transactionsClearAll => 'Clear all';

  @override
  String get transactionsStatusAll => 'All';

  @override
  String get transactionsStatusVerified => 'Verified';

  @override
  String get transactionsStatusFake => 'Fake';

  @override
  String get transactionsStatusDuplicate => 'Duplicate';

  @override
  String get transactionsStatusReview => 'Review';

  @override
  String get transactionsStatusError => 'Error';

  @override
  String get transactionsEmptyTitle => 'No transactions found';

  @override
  String get transactionsEmptyBody => 'Try a different filter or search.';

  @override
  String get transactionsEmptyAction => 'Clear filters';

  @override
  String get transactionsLoadMoreError => 'Couldn\'t load more. Tap to retry.';

  @override
  String get transactionsNoMore => 'No more results';

  @override
  String get transactionsRangeYear => 'This year';

  @override
  String get transactionsRangeAll => 'All time';

  @override
  String get teamActiveSection => 'Active team members';

  @override
  String get teamPendingSection => 'Pending invites';

  @override
  String get teamInviteHeading => 'Invite someone to verify payments';

  @override
  String get teamInviteSubtitle =>
      'They\'ll receive an SMS with a link to accept.';

  @override
  String get teamPhoneLabel => 'Phone number';

  @override
  String get teamPhoneHint => '+2519XXXXXXXX';

  @override
  String get teamNameLabel => 'Name (optional) — what\'s their name?';

  @override
  String get teamBranchLabel => 'Branch label (optional)';

  @override
  String get teamBranchHint => 'e.g., Bole Branch, Main Counter';

  @override
  String get teamSendInvite => 'Send invite';

  @override
  String get teamPhoneInvalid => 'Enter a valid Ethiopian phone number';

  @override
  String get teamInviteTitle => 'Invite team member';

  @override
  String get teamInviteSuccessTitle => 'Invite sent';

  @override
  String get teamShareInviteLink => 'Share invite link';

  @override
  String get teamInviteAcceptHint =>
      'They\'ll appear in your team list once they accept.';

  @override
  String get teamDone => 'Done';

  @override
  String get teamUpgrade => 'Upgrade';

  @override
  String get teamUpgradeBody =>
      'You\'ve used every team seat on your current plan. Upgrade to add more people.';

  @override
  String get teamCapFree =>
      'FREE plan allows 1 team member. Upgrade to add more.';

  @override
  String get teamCapPremium =>
      'PREMIUM plan allows 1 team member. Upgrade to add more.';

  @override
  String get teamCapBusiness =>
      'BUSINESS plan allows 10 team members. Upgrade to add more.';

  @override
  String get teamCapGeneric =>
      'Your plan\'s team limit is reached. Upgrade to add more.';

  @override
  String get teamStatusActive => 'Active';

  @override
  String get teamStatusInvited => 'Invited';

  @override
  String get teamStatusSuspended => 'Suspended';

  @override
  String get teamStatusRemoved => 'Removed';

  @override
  String get teamResend => 'Resend';

  @override
  String get teamRevoke => 'Revoke';

  @override
  String get teamRevokeConfirmTitle => 'Revoke this invite?';

  @override
  String get teamRevokeConfirmBody =>
      'They won\'t be able to join with the current invite link.';

  @override
  String get teamResendSuccess => 'Invite resent';

  @override
  String get teamResendFailed => 'Couldn\'t resend the invite. Try again.';

  @override
  String get teamRemove => 'Remove from team';

  @override
  String get teamRemoveConfirmBody =>
      'They won\'t be able to verify payments anymore. Their past verifications will remain in your history.';

  @override
  String get teamRemoveSuccess => 'Team member removed';

  @override
  String get teamRemoveFailed =>
      'Couldn\'t remove this team member. Try again.';

  @override
  String get teamAlreadyMember => 'This phone is already on your team';

  @override
  String get teamDetailTitle => 'Team member';

  @override
  String get teamNotJoined => 'Invite pending — they have not joined yet';

  @override
  String get teamJoinedLabel => 'Joined';

  @override
  String get teamLastActiveLabel => 'Last active';

  @override
  String get teamChangeBranch => 'Change branch label';

  @override
  String get teamBranchSaved => 'Branch label updated';

  @override
  String get teamSave => 'Save';

  @override
  String get teamCancel => 'Cancel';

  @override
  String get teamNoBranch => 'No branch label';

  @override
  String get teamUnknown => 'Team member';

  @override
  String get profileAccountSection => 'Account';

  @override
  String get profileEditBusiness => 'Edit business info';

  @override
  String get profileChangePin => 'Change PIN';

  @override
  String get profileTeamSection => 'Team';

  @override
  String get profileManageTeam => 'Manage team';

  @override
  String get profileSubscriptionSection => 'Subscription';

  @override
  String get profilePreferencesSection => 'Preferences';

  @override
  String get profileTheme => 'Theme';

  @override
  String get profileThemeSystem => 'System';

  @override
  String get profileThemeLight => 'Light';

  @override
  String get profileThemeDark => 'Dark';

  @override
  String get profileNotifications => 'Notifications';

  @override
  String get profileSupportSection => 'Support';

  @override
  String get profileHelpCenter => 'Help center';

  @override
  String get profileContactSupport => 'Contact support';

  @override
  String get profileSignOut => 'Sign out';

  @override
  String get profileSignOutConfirmTitle => 'Sign out of Yene Verify?';

  @override
  String get profileSignOutConfirmBody =>
      'You\'ll need to sign in again with your phone and PIN.';

  @override
  String get profileComingSoon => 'Coming soon';

  @override
  String get profileVerificationAccounts => 'Verification accounts';

  @override
  String get profileVerificationAccountsSubtitle =>
      'Bank accounts used to verify payments';

  @override
  String get verificationAccountsTitle => 'Verification accounts';

  @override
  String get verificationAccountsIntro =>
      'These numbers are not printed on receipts. Add them once so payments from these banks can be verified automatically.';

  @override
  String get verificationAccountsCbe => 'Commercial Bank of Ethiopia (CBE)';

  @override
  String get verificationAccountsCbeLabel => 'Your CBE account number';

  @override
  String get verificationAccountsAbyssinia => 'Bank of Abyssinia';

  @override
  String get verificationAccountsAbyssiniaLabel =>
      'Your Bank of Abyssinia account number';

  @override
  String get verificationAccountsAwash => 'Awash Bank';

  @override
  String get verificationAccountsAwashLabel => 'Your Awash Bank account number';

  @override
  String get verificationAccountsAccountHint => 'e.g., 1000123456789';

  @override
  String get verificationAccountsCbeHelper =>
      'We only use the last 8 digits for verification.';

  @override
  String get verificationAccountsAbyssiniaHelper =>
      'We only use the last 5 digits for verification.';

  @override
  String get verificationAccountsAwashHelper =>
      'We use this number to look up your account.';

  @override
  String get verificationAccountsInvalidLength => 'Enter 10 to 16 digits';

  @override
  String get verificationAccountsSaved => 'Verification accounts saved';

  @override
  String get verificationAccountsStepUpTitle => 'Confirm with your PIN';

  @override
  String get verificationAccountsStepUpBody =>
      'Enter your PIN to save bank account details.';

  @override
  String get onboardingAccountsTitle => 'Bank account details (optional)';

  @override
  String get onboardingAccountsSubtitle =>
      'Add the account numbers your bank needs to verify payments.';

  @override
  String get onboardingAccountsInvalid =>
      'Check the number of digits for the selected banks.';

  @override
  String teamInvitedAgo(String time) {
    return 'Invited $time';
  }

  @override
  String teamInviteSent(String phone) {
    return 'Invite sent to $phone';
  }

  @override
  String teamSeatsRemaining(int remaining, int limit) {
    return '$remaining of $limit team seats remaining';
  }

  @override
  String teamActivity(int count) {
    return '$count verifications last 30 days';
  }

  @override
  String teamRemoveConfirmTitle(String name) {
    return 'Remove $name?';
  }

  @override
  String profileTeamCount(int members, int pending) {
    return '$members members · $pending pending';
  }

  @override
  String profilePlanRenews(String plan, int days) {
    return '$plan · renews in $days days';
  }

  @override
  String profilePlanNoRenewal(String plan) {
    return '$plan';
  }

  @override
  String profileBusiness(String name) {
    return 'Business: $name';
  }

  @override
  String get billingScreenTitle => 'Billing';

  @override
  String get billingPlansSection => 'Available plans';

  @override
  String get billingNoPlans => 'No plans are available right now.';

  @override
  String get billingHistoryTitle => 'Payment history';

  @override
  String get billingViewHistory => 'View history';

  @override
  String get billingNoHistory => 'No billing history yet';

  @override
  String get billingNoHistoryBody => 'Payments you make will appear here.';

  @override
  String get billingManage => 'Manage';

  @override
  String get billingRenew => 'Renew';

  @override
  String get billingChoose => 'Choose';

  @override
  String get billingUpgrade => 'Upgrade';

  @override
  String get billingCurrentBadge => 'Current plan';

  @override
  String billingExpiresIn(int days) {
    return 'Expires in $days days';
  }

  @override
  String get billingUnlimited => 'Unlimited';

  @override
  String billingCreditsLeft(int count) {
    return '$count credits left';
  }

  @override
  String get billingOwnerOnly => 'Only the business owner can manage billing.';

  @override
  String get billingBack => 'Back';

  @override
  String billingPayFor(String name) {
    return 'Pay for $name';
  }

  @override
  String billingPayAmount(String amount) {
    return 'Pay $amount to activate your plan';
  }

  @override
  String get billingMethodCbe => 'CBE';

  @override
  String get billingMethodTelebirr => 'Telebirr';

  @override
  String get billingAccountNumber => 'Account number';

  @override
  String get billingAccountName => 'Account name';

  @override
  String get billingPhoneNumber => 'Phone number';

  @override
  String get billingCopy => 'Copy';

  @override
  String get billingCopied => 'Copied to clipboard';

  @override
  String get billingSteps =>
      '1. Pay the exact amount using CBE or Telebirr.\n2. Take a screenshot of your confirmation.\n3. Upload it below.';

  @override
  String get billingIvePaid => 'I\'ve paid';

  @override
  String get billingUploadHeading => 'Upload your payment confirmation';

  @override
  String get billingUploadBody =>
      'Upload a screenshot showing the amount, date and reference.';

  @override
  String get billingChange => 'Change';

  @override
  String get billingRemove => 'Remove';

  @override
  String get billingSubmitForVerification => 'Submit for verification';

  @override
  String get billingSessionExpired =>
      'This checkout session has expired. Start again from Billing.';

  @override
  String get billingResultApprovedTitle => 'Payment verified';

  @override
  String billingResultActivated(String name) {
    return '$name activated';
  }

  @override
  String billingResultActiveUntil(String date) {
    return 'Active until $date';
  }

  @override
  String billingResultCreditsAdded(int count) {
    return '+$count verifications';
  }

  @override
  String get billingResultStartUsing => 'Start using your credits';

  @override
  String get billingResultPendingTitle => 'Verification in progress';

  @override
  String get billingResultPendingBody =>
      'We\'re confirming your payment with the bank. This usually takes a few seconds.';

  @override
  String get billingResultTimeout =>
      'Verification is taking too long. Check billing history later.';

  @override
  String get billingResultCheckHistory => 'Check billing history';

  @override
  String get billingResultReviewTitle => 'Payment under review';

  @override
  String get billingResultReviewBody =>
      'The amount doesn\'t match the package price. Our team will review this within 24 hours.';

  @override
  String get billingResultRejectedTitle => 'Payment not verified';

  @override
  String get billingResultRejectedBody => 'The receipt couldn\'t be verified.';

  @override
  String get billingResultDuplicateBody => 'This receipt was already used.';

  @override
  String get billingTryAgain => 'Try again';

  @override
  String get billingContactSupport => 'Contact support';

  @override
  String get billingSupportSoon => 'Support is coming soon.';

  @override
  String get billingStatusPending => 'Pending';

  @override
  String get billingStatusApproved => 'Approved';

  @override
  String get billingStatusMismatch => 'Amount mismatch';

  @override
  String get billingStatusReview => 'Needs review';

  @override
  String get billingStatusDuplicate => 'Duplicate';

  @override
  String get billingStatusFake => 'Fake';

  @override
  String get billingStatusRejected => 'Rejected';

  @override
  String get billingExpectedAmount => 'Expected amount';

  @override
  String get billingSubmittedAmount => 'Submitted amount';

  @override
  String get billingReference => 'Reference';

  @override
  String get billingSubmittedOn => 'Submitted';

  @override
  String get billingResultDetailsTitle => 'Payment details';

  @override
  String get billingFeatureUnlimited => 'Unlimited verifications';

  @override
  String billingFeatureCredits(int count) {
    return '$count verifications/month';
  }

  @override
  String get billingFeatureSeatsOne => '1 team member';

  @override
  String billingFeatureSeats(int count) {
    return '$count team members';
  }

  @override
  String get billingFeatureSeatsUnlimited => 'Unlimited team members';
}
