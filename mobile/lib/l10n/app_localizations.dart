import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_am.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('am'),
    Locale('en')
  ];

  /// Application name
  ///
  /// In en, this message translates to:
  /// **'Yene Verify'**
  String get appName;

  /// No description provided for @loginTitle.
  ///
  /// In en, this message translates to:
  /// **'Yene Verify'**
  String get loginTitle;

  /// No description provided for @loginSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your phone number to get started'**
  String get loginSubtitle;

  /// Primary marketing tagline
  ///
  /// In en, this message translates to:
  /// **'Verify any Ethiopian bank payment. In seconds.'**
  String get taglinePrimary;

  /// Short marketing tagline
  ///
  /// In en, this message translates to:
  /// **'Verify. Trust. Grow.'**
  String get taglineShort;

  /// No description provided for @continueLabel.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueLabel;

  /// No description provided for @cancelLabel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancelLabel;

  /// No description provided for @confirmLabel.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get confirmLabel;

  /// No description provided for @saveLabel.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get saveLabel;

  /// No description provided for @deleteLabel.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get deleteLabel;

  /// No description provided for @retryLabel.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get retryLabel;

  /// No description provided for @okLabel.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get okLabel;

  /// No description provided for @closeLabel.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get closeLabel;

  /// No description provided for @backLabel.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get backLabel;

  /// No description provided for @doneLabel.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get doneLabel;

  /// No description provided for @loadingLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get loadingLabel;

  /// No description provided for @requiredField.
  ///
  /// In en, this message translates to:
  /// **'This field is required'**
  String get requiredField;

  /// No description provided for @genericError.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get genericError;

  /// No description provided for @networkError.
  ///
  /// In en, this message translates to:
  /// **'No internet connection. Please check your network.'**
  String get networkError;

  /// No description provided for @sessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session has expired. Please log in again.'**
  String get sessionExpired;

  /// No description provided for @phoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Phone number'**
  String get phoneNumber;

  /// No description provided for @phoneHint.
  ///
  /// In en, this message translates to:
  /// **'+251 9XX XXX XXX'**
  String get phoneHint;

  /// No description provided for @phoneInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid Ethiopian phone number'**
  String get phoneInvalid;

  /// No description provided for @otpTitle.
  ///
  /// In en, this message translates to:
  /// **'Enter verification code'**
  String get otpTitle;

  /// No description provided for @otpSubtitle.
  ///
  /// In en, this message translates to:
  /// **'We sent a 6-digit code to {phone}'**
  String otpSubtitle(String phone);

  /// No description provided for @otpResend.
  ///
  /// In en, this message translates to:
  /// **'Resend code'**
  String get otpResend;

  /// No description provided for @otpResendIn.
  ///
  /// In en, this message translates to:
  /// **'Resend in {seconds}s'**
  String otpResendIn(int seconds);

  /// No description provided for @otpInvalid.
  ///
  /// In en, this message translates to:
  /// **'Incorrect code. Try again.'**
  String get otpInvalid;

  /// No description provided for @otpExpired.
  ///
  /// In en, this message translates to:
  /// **'Code has expired. Request a new one.'**
  String get otpExpired;

  /// No description provided for @pinIncorrect.
  ///
  /// In en, this message translates to:
  /// **'Incorrect PIN. Try again.'**
  String get pinIncorrect;

  /// No description provided for @authWeakPin.
  ///
  /// In en, this message translates to:
  /// **'PIN is too weak. Use 4 or 6 digits, avoid sequential or repeated numbers.'**
  String get authWeakPin;

  /// No description provided for @pinLocked.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Try again in {minutes} minutes.'**
  String pinLocked(int minutes);

  /// No description provided for @errorDeviceLimit.
  ///
  /// In en, this message translates to:
  /// **'Too many devices. Remove one from settings.'**
  String get errorDeviceLimit;

  /// No description provided for @errorAccountBanned.
  ///
  /// In en, this message translates to:
  /// **'This account has been suspended. Contact support.'**
  String get errorAccountBanned;

  /// No description provided for @pinSetupTitle.
  ///
  /// In en, this message translates to:
  /// **'Create your PIN'**
  String get pinSetupTitle;

  /// No description provided for @pinSetupSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You\'ll use this every time you open Yene Verify'**
  String get pinSetupSubtitle;

  /// No description provided for @pinEntryTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get pinEntryTitle;

  /// No description provided for @pinEntryForgot.
  ///
  /// In en, this message translates to:
  /// **'Forgot PIN?'**
  String get pinEntryForgot;

  /// No description provided for @otpMaxAttempts.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Please wait before trying again.'**
  String get otpMaxAttempts;

  /// No description provided for @pinTitle.
  ///
  /// In en, this message translates to:
  /// **'Set your PIN'**
  String get pinTitle;

  /// No description provided for @pinSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose a {length}-digit PIN to secure your account'**
  String pinSubtitle(int length);

  /// No description provided for @pinConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Confirm your PIN'**
  String get pinConfirmTitle;

  /// No description provided for @pinMismatch.
  ///
  /// In en, this message translates to:
  /// **'PINs don\'t match. Try again.'**
  String get pinMismatch;

  /// No description provided for @pinWrong.
  ///
  /// In en, this message translates to:
  /// **'Incorrect PIN. {attemptsLeft} attempts left.'**
  String pinWrong(int attemptsLeft);

  /// No description provided for @enterPin.
  ///
  /// In en, this message translates to:
  /// **'Enter your PIN'**
  String get enterPin;

  /// No description provided for @biometricTitle.
  ///
  /// In en, this message translates to:
  /// **'Enable biometric unlock'**
  String get biometricTitle;

  /// No description provided for @biometricSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Use fingerprint or Face ID to unlock quickly and securely.'**
  String get biometricSubtitle;

  /// No description provided for @biometricEnable.
  ///
  /// In en, this message translates to:
  /// **'Enable biometrics'**
  String get biometricEnable;

  /// No description provided for @biometricSkip.
  ///
  /// In en, this message translates to:
  /// **'Skip for now'**
  String get biometricSkip;

  /// No description provided for @biometricPrompt.
  ///
  /// In en, this message translates to:
  /// **'Verify your identity'**
  String get biometricPrompt;

  /// No description provided for @biometricFailed.
  ///
  /// In en, this message translates to:
  /// **'Biometric authentication failed. Use your PIN.'**
  String get biometricFailed;

  /// No description provided for @verifyTitle.
  ///
  /// In en, this message translates to:
  /// **'Verify Payment'**
  String get verifyTitle;

  /// No description provided for @verifySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Take or upload a photo of the customer\'s payment confirmation.'**
  String get verifySubtitle;

  /// Camera capture option label
  ///
  /// In en, this message translates to:
  /// **'Take Photo'**
  String get takePhoto;

  /// Gallery picker option label
  ///
  /// In en, this message translates to:
  /// **'Upload Image'**
  String get uploadImage;

  /// No description provided for @choosePhotoSource.
  ///
  /// In en, this message translates to:
  /// **'Add receipt photo'**
  String get choosePhotoSource;

  /// No description provided for @takePhotoDescription.
  ///
  /// In en, this message translates to:
  /// **'Capture the payment confirmation screen'**
  String get takePhotoDescription;

  /// No description provided for @uploadImageDescription.
  ///
  /// In en, this message translates to:
  /// **'Choose an existing photo from your gallery'**
  String get uploadImageDescription;

  /// No description provided for @verificationPending.
  ///
  /// In en, this message translates to:
  /// **'Verifying…'**
  String get verificationPending;

  /// No description provided for @verificationPendingDetail.
  ///
  /// In en, this message translates to:
  /// **'Checking the receipt with {bank}. This usually takes under 10 seconds.'**
  String verificationPendingDetail(String bank);

  /// No description provided for @verdictVerified.
  ///
  /// In en, this message translates to:
  /// **'VERIFIED'**
  String get verdictVerified;

  /// No description provided for @verdictFake.
  ///
  /// In en, this message translates to:
  /// **'FAKE'**
  String get verdictFake;

  /// No description provided for @verdictDuplicate.
  ///
  /// In en, this message translates to:
  /// **'DUPLICATE'**
  String get verdictDuplicate;

  /// No description provided for @verdictPending.
  ///
  /// In en, this message translates to:
  /// **'PENDING'**
  String get verdictPending;

  /// No description provided for @verdictNeedsReview.
  ///
  /// In en, this message translates to:
  /// **'REVIEW'**
  String get verdictNeedsReview;

  /// No description provided for @verdictError.
  ///
  /// In en, this message translates to:
  /// **'ERROR'**
  String get verdictError;

  /// No description provided for @verdictVerifiedMessage.
  ///
  /// In en, this message translates to:
  /// **'This receipt is genuine and verified.'**
  String get verdictVerifiedMessage;

  /// No description provided for @verdictFakeMessage.
  ///
  /// In en, this message translates to:
  /// **'This receipt could not be verified. It may be fake.'**
  String get verdictFakeMessage;

  /// No description provided for @verdictDuplicateMessage.
  ///
  /// In en, this message translates to:
  /// **'This receipt has already been verified on {date}.'**
  String verdictDuplicateMessage(String date);

  /// No description provided for @verdictErrorMessage.
  ///
  /// In en, this message translates to:
  /// **'Could not reach {bank} at this time. Please try again.'**
  String verdictErrorMessage(String bank);

  /// No description provided for @transactionReference.
  ///
  /// In en, this message translates to:
  /// **'Transaction Reference'**
  String get transactionReference;

  /// No description provided for @transactionAmount.
  ///
  /// In en, this message translates to:
  /// **'Amount'**
  String get transactionAmount;

  /// No description provided for @transactionDate.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get transactionDate;

  /// No description provided for @transactionBank.
  ///
  /// In en, this message translates to:
  /// **'Bank'**
  String get transactionBank;

  /// No description provided for @transactionSender.
  ///
  /// In en, this message translates to:
  /// **'Sender'**
  String get transactionSender;

  /// No description provided for @transactionReceiver.
  ///
  /// In en, this message translates to:
  /// **'Receiver'**
  String get transactionReceiver;

  /// No description provided for @transactionsTitle.
  ///
  /// In en, this message translates to:
  /// **'Transactions'**
  String get transactionsTitle;

  /// No description provided for @noTransactionsTitle.
  ///
  /// In en, this message translates to:
  /// **'No verifications yet'**
  String get noTransactionsTitle;

  /// No description provided for @noTransactionsBody.
  ///
  /// In en, this message translates to:
  /// **'Verified payments will appear here.'**
  String get noTransactionsBody;

  /// No description provided for @verifyFirst.
  ///
  /// In en, this message translates to:
  /// **'Verify a payment'**
  String get verifyFirst;

  /// No description provided for @homeTitle.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get homeTitle;

  /// No description provided for @analyticsTitle.
  ///
  /// In en, this message translates to:
  /// **'Analytics'**
  String get analyticsTitle;

  /// No description provided for @profileTitle.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profileTitle;

  /// No description provided for @settingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// No description provided for @historyTitle.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get historyTitle;

  /// No description provided for @subMerchantsTitle.
  ///
  /// In en, this message translates to:
  /// **'Team'**
  String get subMerchantsTitle;

  /// No description provided for @addSubMerchant.
  ///
  /// In en, this message translates to:
  /// **'Add team member'**
  String get addSubMerchant;

  /// No description provided for @noSubMerchantsTitle.
  ///
  /// In en, this message translates to:
  /// **'No team members yet'**
  String get noSubMerchantsTitle;

  /// No description provided for @noSubMerchantsBody.
  ///
  /// In en, this message translates to:
  /// **'Add cashiers or branch staff to verify payments on your behalf.'**
  String get noSubMerchantsBody;

  /// No description provided for @creditsRemaining.
  ///
  /// In en, this message translates to:
  /// **'{count} credits remaining'**
  String creditsRemaining(int count);

  /// No description provided for @creditsLow.
  ///
  /// In en, this message translates to:
  /// **'Only {count} credits left. Renew your package.'**
  String creditsLow(int count);

  /// No description provided for @creditsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Please renew your package to continue verifying receipts.'**
  String get creditsEmpty;

  /// No description provided for @creditsUnlimited.
  ///
  /// In en, this message translates to:
  /// **'Unlimited'**
  String get creditsUnlimited;

  /// No description provided for @renewPackage.
  ///
  /// In en, this message translates to:
  /// **'Renew package'**
  String get renewPackage;

  /// No description provided for @billingTitle.
  ///
  /// In en, this message translates to:
  /// **'Subscription'**
  String get billingTitle;

  /// No description provided for @billingCurrentPlan.
  ///
  /// In en, this message translates to:
  /// **'Current plan'**
  String get billingCurrentPlan;

  /// No description provided for @billingPaymentInstructions.
  ///
  /// In en, this message translates to:
  /// **'Transfer {amount} to the account below, then upload your payment screenshot.'**
  String billingPaymentInstructions(String amount);

  /// No description provided for @billingUploadProof.
  ///
  /// In en, this message translates to:
  /// **'Upload payment proof'**
  String get billingUploadProof;

  /// No description provided for @billingVerifying.
  ///
  /// In en, this message translates to:
  /// **'Verifying your payment…'**
  String get billingVerifying;

  /// No description provided for @billingSuccess.
  ///
  /// In en, this message translates to:
  /// **'Payment verified. Your plan is now active.'**
  String get billingSuccess;

  /// No description provided for @billingFailed.
  ///
  /// In en, this message translates to:
  /// **'Payment could not be verified. Please contact support.'**
  String get billingFailed;

  /// No description provided for @billingNeedsReview.
  ///
  /// In en, this message translates to:
  /// **'Your payment is under review. We\'ll notify you shortly.'**
  String get billingNeedsReview;

  /// No description provided for @planFree.
  ///
  /// In en, this message translates to:
  /// **'Free'**
  String get planFree;

  /// No description provided for @planPremium.
  ///
  /// In en, this message translates to:
  /// **'Premium'**
  String get planPremium;

  /// No description provided for @planBusiness.
  ///
  /// In en, this message translates to:
  /// **'Business'**
  String get planBusiness;

  /// No description provided for @planBusinessPro.
  ///
  /// In en, this message translates to:
  /// **'Business Pro'**
  String get planBusinessPro;

  /// No description provided for @planApiIntegration.
  ///
  /// In en, this message translates to:
  /// **'API Integration'**
  String get planApiIntegration;

  /// No description provided for @planVerificationsPerMonth.
  ///
  /// In en, this message translates to:
  /// **'{count} verifications / month'**
  String planVerificationsPerMonth(int count);

  /// No description provided for @planUnlimitedVerifications.
  ///
  /// In en, this message translates to:
  /// **'Unlimited verifications'**
  String get planUnlimitedVerifications;

  /// No description provided for @notificationsTitle.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notificationsTitle;

  /// No description provided for @noNotificationsTitle.
  ///
  /// In en, this message translates to:
  /// **'All caught up'**
  String get noNotificationsTitle;

  /// No description provided for @noNotificationsBody.
  ///
  /// In en, this message translates to:
  /// **'You have no new notifications.'**
  String get noNotificationsBody;

  /// No description provided for @logoutLabel.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get logoutLabel;

  /// No description provided for @logoutConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Log out?'**
  String get logoutConfirmTitle;

  /// No description provided for @logoutConfirmBody.
  ///
  /// In en, this message translates to:
  /// **'You will need to verify your identity to log back in.'**
  String get logoutConfirmBody;

  /// No description provided for @devicesTitle.
  ///
  /// In en, this message translates to:
  /// **'Trusted devices'**
  String get devicesTitle;

  /// No description provided for @deviceThisDevice.
  ///
  /// In en, this message translates to:
  /// **'This device'**
  String get deviceThisDevice;

  /// No description provided for @deviceRevoke.
  ///
  /// In en, this message translates to:
  /// **'Remove device'**
  String get deviceRevoke;

  /// No description provided for @deviceRevokeConfirm.
  ///
  /// In en, this message translates to:
  /// **'Remove this device? You will need to re-authenticate on it.'**
  String get deviceRevokeConfirm;

  /// No description provided for @businessName.
  ///
  /// In en, this message translates to:
  /// **'Business name'**
  String get businessName;

  /// No description provided for @businessType.
  ///
  /// In en, this message translates to:
  /// **'Business type'**
  String get businessType;

  /// No description provided for @fullName.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get fullName;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @languageEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// No description provided for @languageAmharic.
  ///
  /// In en, this message translates to:
  /// **'አማርኛ'**
  String get languageAmharic;

  /// No description provided for @darkMode.
  ///
  /// In en, this message translates to:
  /// **'Dark mode'**
  String get darkMode;

  /// No description provided for @appVersion.
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String appVersion(String version);

  /// No description provided for @copyReference.
  ///
  /// In en, this message translates to:
  /// **'Copy reference'**
  String get copyReference;

  /// No description provided for @copied.
  ///
  /// In en, this message translates to:
  /// **'Copied!'**
  String get copied;

  /// No description provided for @shareLabel.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get shareLabel;

  /// No description provided for @exportLabel.
  ///
  /// In en, this message translates to:
  /// **'Export'**
  String get exportLabel;

  /// No description provided for @filterLabel.
  ///
  /// In en, this message translates to:
  /// **'Filter'**
  String get filterLabel;

  /// No description provided for @searchLabel.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get searchLabel;

  /// No description provided for @searchHint.
  ///
  /// In en, this message translates to:
  /// **'Search transactions…'**
  String get searchHint;

  /// No description provided for @noSearchResults.
  ///
  /// In en, this message translates to:
  /// **'No results for \"{query}\"'**
  String noSearchResults(String query);

  /// No description provided for @dateRangeLabel.
  ///
  /// In en, this message translates to:
  /// **'Date range'**
  String get dateRangeLabel;

  /// No description provided for @bankLabel.
  ///
  /// In en, this message translates to:
  /// **'Bank'**
  String get bankLabel;

  /// No description provided for @allBanks.
  ///
  /// In en, this message translates to:
  /// **'All banks'**
  String get allBanks;

  /// No description provided for @bankCbe.
  ///
  /// In en, this message translates to:
  /// **'Commercial Bank of Ethiopia'**
  String get bankCbe;

  /// No description provided for @bankTelebirr.
  ///
  /// In en, this message translates to:
  /// **'Telebirr'**
  String get bankTelebirr;

  /// No description provided for @bankAwash.
  ///
  /// In en, this message translates to:
  /// **'Awash Bank'**
  String get bankAwash;

  /// No description provided for @bankDashen.
  ///
  /// In en, this message translates to:
  /// **'Dashen Bank'**
  String get bankDashen;

  /// No description provided for @bankAbyssinia.
  ///
  /// In en, this message translates to:
  /// **'Bank of Abyssinia'**
  String get bankAbyssinia;

  /// No description provided for @bankMpesa.
  ///
  /// In en, this message translates to:
  /// **'M-Pesa'**
  String get bankMpesa;

  /// No description provided for @bankZemen.
  ///
  /// In en, this message translates to:
  /// **'Zemen Bank'**
  String get bankZemen;

  /// No description provided for @insightsTitle.
  ///
  /// In en, this message translates to:
  /// **'Insights'**
  String get insightsTitle;

  /// No description provided for @insightBestProducts.
  ///
  /// In en, this message translates to:
  /// **'Best selling products'**
  String get insightBestProducts;

  /// No description provided for @insightPeakHours.
  ///
  /// In en, this message translates to:
  /// **'Peak hours'**
  String get insightPeakHours;

  /// No description provided for @insightBestDays.
  ///
  /// In en, this message translates to:
  /// **'Best days'**
  String get insightBestDays;

  /// No description provided for @insightTrend.
  ///
  /// In en, this message translates to:
  /// **'Trend'**
  String get insightTrend;

  /// No description provided for @insightRecommendations.
  ///
  /// In en, this message translates to:
  /// **'Recommendations'**
  String get insightRecommendations;

  /// No description provided for @insightAnomalies.
  ///
  /// In en, this message translates to:
  /// **'Anomalies'**
  String get insightAnomalies;

  /// No description provided for @noInsightsTitle.
  ///
  /// In en, this message translates to:
  /// **'Not enough data yet'**
  String get noInsightsTitle;

  /// No description provided for @noInsightsBody.
  ///
  /// In en, this message translates to:
  /// **'Complete more verifications to unlock insights.'**
  String get noInsightsBody;

  /// No description provided for @trendUp.
  ///
  /// In en, this message translates to:
  /// **'+{percent}% vs last {period}'**
  String trendUp(String percent, String period);

  /// No description provided for @trendDown.
  ///
  /// In en, this message translates to:
  /// **'-{percent}% vs last {period}'**
  String trendDown(String percent, String period);

  /// No description provided for @periodWeek.
  ///
  /// In en, this message translates to:
  /// **'week'**
  String get periodWeek;

  /// No description provided for @periodMonth.
  ///
  /// In en, this message translates to:
  /// **'month'**
  String get periodMonth;

  /// No description provided for @auditLogTitle.
  ///
  /// In en, this message translates to:
  /// **'Audit log'**
  String get auditLogTitle;

  /// No description provided for @permissionCameraTitle.
  ///
  /// In en, this message translates to:
  /// **'Camera access needed'**
  String get permissionCameraTitle;

  /// No description provided for @permissionCameraBody.
  ///
  /// In en, this message translates to:
  /// **'Yene Verify needs camera access to capture payment screenshots.'**
  String get permissionCameraBody;

  /// No description provided for @permissionGalleryTitle.
  ///
  /// In en, this message translates to:
  /// **'Photo library access needed'**
  String get permissionGalleryTitle;

  /// No description provided for @permissionGalleryBody.
  ///
  /// In en, this message translates to:
  /// **'Yene Verify needs photo library access to upload payment screenshots.'**
  String get permissionGalleryBody;

  /// No description provided for @permissionOpenSettings.
  ///
  /// In en, this message translates to:
  /// **'Open settings'**
  String get permissionOpenSettings;

  /// No description provided for @onboardingStep1Title.
  ///
  /// In en, this message translates to:
  /// **'Verify payments instantly'**
  String get onboardingStep1Title;

  /// No description provided for @onboardingStep1Body.
  ///
  /// In en, this message translates to:
  /// **'Take a photo of any Ethiopian bank receipt and get a verified result in under 10 seconds.'**
  String get onboardingStep1Body;

  /// No description provided for @onboardingStep2Title.
  ///
  /// In en, this message translates to:
  /// **'Stop payment fraud'**
  String get onboardingStep2Title;

  /// No description provided for @onboardingStep2Body.
  ///
  /// In en, this message translates to:
  /// **'Duplicate receipt detection protects your business from the same receipt being used twice.'**
  String get onboardingStep2Body;

  /// No description provided for @onboardingStep3Title.
  ///
  /// In en, this message translates to:
  /// **'Grow with insights'**
  String get onboardingStep3Title;

  /// No description provided for @onboardingStep3Body.
  ///
  /// In en, this message translates to:
  /// **'Understand your peak hours, best products, and sales trends — all from your verified transactions.'**
  String get onboardingStep3Body;

  /// No description provided for @getStarted.
  ///
  /// In en, this message translates to:
  /// **'Get started'**
  String get getStarted;

  /// No description provided for @learnMoreLabel.
  ///
  /// In en, this message translates to:
  /// **'Learn more'**
  String get learnMoreLabel;

  /// Step 20 placeholder snackbar
  ///
  /// In en, this message translates to:
  /// **'Auth flow — coming Step 21'**
  String get authComingSoon;

  /// Step 20 debug link to the design-system showcase
  ///
  /// In en, this message translates to:
  /// **'Debug: Design System'**
  String get debugDesignSystem;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['am', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'am':
      return AppLocalizationsAm();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
