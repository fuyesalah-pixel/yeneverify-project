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

  /// No description provided for @onboardingMerchantTitle.
  ///
  /// In en, this message translates to:
  /// **'Let\'s set up your business'**
  String get onboardingMerchantTitle;

  /// No description provided for @onboardingMerchantSubtitle.
  ///
  /// In en, this message translates to:
  /// **'We\'ll use this to personalize your Yene Verify experience'**
  String get onboardingMerchantSubtitle;

  /// No description provided for @businessNameHint.
  ///
  /// In en, this message translates to:
  /// **'e.g., Selam Coffee, Addis Electronics'**
  String get businessNameHint;

  /// No description provided for @businessNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your business name'**
  String get businessNameRequired;

  /// No description provided for @businessNameTooShort.
  ///
  /// In en, this message translates to:
  /// **'Business name must be at least 2 characters'**
  String get businessNameTooShort;

  /// No description provided for @businessNameTooLong.
  ///
  /// In en, this message translates to:
  /// **'Business name must be 80 characters or less'**
  String get businessNameTooLong;

  /// No description provided for @addMoreDetails.
  ///
  /// In en, this message translates to:
  /// **'Add more details'**
  String get addMoreDetails;

  /// No description provided for @businessTypeCafe.
  ///
  /// In en, this message translates to:
  /// **'Cafe'**
  String get businessTypeCafe;

  /// No description provided for @businessTypeRestaurant.
  ///
  /// In en, this message translates to:
  /// **'Restaurant'**
  String get businessTypeRestaurant;

  /// No description provided for @businessTypeRetail.
  ///
  /// In en, this message translates to:
  /// **'Retail'**
  String get businessTypeRetail;

  /// No description provided for @businessTypeServices.
  ///
  /// In en, this message translates to:
  /// **'Services'**
  String get businessTypeServices;

  /// No description provided for @businessTypeOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get businessTypeOther;

  /// No description provided for @tinLabel.
  ///
  /// In en, this message translates to:
  /// **'TIN (Tax ID)'**
  String get tinLabel;

  /// No description provided for @addressLabel.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get addressLabel;

  /// No description provided for @cityLabel.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get cityLabel;

  /// No description provided for @createBusiness.
  ///
  /// In en, this message translates to:
  /// **'Create business'**
  String get createBusiness;

  /// No description provided for @onboardingSuccessTitle.
  ///
  /// In en, this message translates to:
  /// **'You\'re all set'**
  String get onboardingSuccessTitle;

  /// No description provided for @onboardingSuccessSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your business {businessName} is now on Yene Verify.'**
  String onboardingSuccessSubtitle(String businessName);

  /// No description provided for @inviteTitle.
  ///
  /// In en, this message translates to:
  /// **'You\'re invited'**
  String get inviteTitle;

  /// No description provided for @inviteBody.
  ///
  /// In en, this message translates to:
  /// **'{merchantName} invited you to join their team'**
  String inviteBody(String merchantName);

  /// No description provided for @inviteBranch.
  ///
  /// In en, this message translates to:
  /// **'Branch: {branchLabel}'**
  String inviteBranch(String branchLabel);

  /// No description provided for @inviteAbility.
  ///
  /// In en, this message translates to:
  /// **'You\'ll be able to verify payments for this business.'**
  String get inviteAbility;

  /// No description provided for @inviteCodeLabel.
  ///
  /// In en, this message translates to:
  /// **'Enter the code from your SMS'**
  String get inviteCodeLabel;

  /// No description provided for @inviteCodeHint.
  ///
  /// In en, this message translates to:
  /// **'Paste your invite code'**
  String get inviteCodeHint;

  /// No description provided for @acceptInvite.
  ///
  /// In en, this message translates to:
  /// **'Accept invite'**
  String get acceptInvite;

  /// No description provided for @declineInvite.
  ///
  /// In en, this message translates to:
  /// **'Decline'**
  String get declineInvite;

  /// No description provided for @declineInviteConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Decline this invite?'**
  String get declineInviteConfirmTitle;

  /// No description provided for @declineInviteConfirmBody.
  ///
  /// In en, this message translates to:
  /// **'You\'ll need a new invite to join {merchantName}.'**
  String declineInviteConfirmBody(String merchantName);

  /// No description provided for @inviteExpired.
  ///
  /// In en, this message translates to:
  /// **'This invite has expired. Ask {merchantName} for a new one.'**
  String inviteExpired(String merchantName);

  /// No description provided for @inviteConsumed.
  ///
  /// In en, this message translates to:
  /// **'This invite was already used.'**
  String get inviteConsumed;

  /// No description provided for @inviteInvalid.
  ///
  /// In en, this message translates to:
  /// **'That code doesn\'t match. Check the SMS.'**
  String get inviteInvalid;

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

  /// Verify screen heading
  ///
  /// In en, this message translates to:
  /// **'Verify a payment'**
  String get verifyHeading;

  /// No description provided for @verifyHeadingSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Upload or photograph the customer\'s bank confirmation to verify it in seconds.'**
  String get verifyHeadingSubtitle;

  /// No description provided for @takePhotoCardSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Use your camera to capture the receipt'**
  String get takePhotoCardSubtitle;

  /// No description provided for @uploadImageCardSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose a screenshot from your gallery'**
  String get uploadImageCardSubtitle;

  /// Credits info card on the verify screen
  ///
  /// In en, this message translates to:
  /// **'You have {count} verifications remaining.'**
  String verificationsRemaining(int count);

  /// No description provided for @unlimitedVerifications.
  ///
  /// In en, this message translates to:
  /// **'Unlimited verifications'**
  String get unlimitedVerifications;

  /// No description provided for @preparingImage.
  ///
  /// In en, this message translates to:
  /// **'Preparing image…'**
  String get preparingImage;

  /// No description provided for @uploadingPercent.
  ///
  /// In en, this message translates to:
  /// **'Uploading… {percent}%'**
  String uploadingPercent(int percent);

  /// No description provided for @verifyTakesSeconds.
  ///
  /// In en, this message translates to:
  /// **'This takes a few seconds…'**
  String get verifyTakesSeconds;

  /// No description provided for @verifyStillWorking.
  ///
  /// In en, this message translates to:
  /// **'Still verifying…'**
  String get verifyStillWorking;

  /// No description provided for @verifyTooLong.
  ///
  /// In en, this message translates to:
  /// **'Verification is taking too long. Check back in a minute.'**
  String get verifyTooLong;

  /// No description provided for @errorImageTooLarge.
  ///
  /// In en, this message translates to:
  /// **'Image too large. Try a smaller screenshot.'**
  String get errorImageTooLarge;

  /// No description provided for @errorInvalidImageType.
  ///
  /// In en, this message translates to:
  /// **'Invalid image format. Use JPEG or PNG.'**
  String get errorInvalidImageType;

  /// No description provided for @errorUploadMismatch.
  ///
  /// In en, this message translates to:
  /// **'Upload verification failed. Try again.'**
  String get errorUploadMismatch;

  /// No description provided for @errorUploadIncomplete.
  ///
  /// In en, this message translates to:
  /// **'Upload didn\'t complete. Check your connection.'**
  String get errorUploadIncomplete;

  /// No description provided for @errorCreditsExhausted.
  ///
  /// In en, this message translates to:
  /// **'You\'re out of credits. Top up to continue.'**
  String get errorCreditsExhausted;

  /// No description provided for @errorBankNotDetected.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t identify the bank in this receipt. Try a clearer photo.'**
  String get errorBankNotDetected;

  /// No description provided for @cameraNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'Camera not available. Use Upload image instead.'**
  String get cameraNotAvailable;

  /// No description provided for @cameraAccessNeeded.
  ///
  /// In en, this message translates to:
  /// **'Camera access needed'**
  String get cameraAccessNeeded;

  /// No description provided for @cameraAccessBody.
  ///
  /// In en, this message translates to:
  /// **'Allow camera access in your system settings to photograph receipts.'**
  String get cameraAccessBody;

  /// No description provided for @photoAccessNeeded.
  ///
  /// In en, this message translates to:
  /// **'Photo access needed'**
  String get photoAccessNeeded;

  /// No description provided for @photoAccessBody.
  ///
  /// In en, this message translates to:
  /// **'Allow photo access in your system settings to pick a receipt image.'**
  String get photoAccessBody;

  /// No description provided for @openSettings.
  ///
  /// In en, this message translates to:
  /// **'Open settings'**
  String get openSettings;

  /// No description provided for @usePhoto.
  ///
  /// In en, this message translates to:
  /// **'Use photo'**
  String get usePhoto;

  /// No description provided for @retakePhoto.
  ///
  /// In en, this message translates to:
  /// **'Retake'**
  String get retakePhoto;

  /// No description provided for @switchCamera.
  ///
  /// In en, this message translates to:
  /// **'Switch camera'**
  String get switchCamera;

  /// No description provided for @toggleFlash.
  ///
  /// In en, this message translates to:
  /// **'Toggle flash'**
  String get toggleFlash;

  /// No description provided for @galleryUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t open your gallery. Try again.'**
  String get galleryUnavailable;

  /// No description provided for @verdictTitle.
  ///
  /// In en, this message translates to:
  /// **'Verification result'**
  String get verdictTitle;

  /// No description provided for @backToVerify.
  ///
  /// In en, this message translates to:
  /// **'Back to verify'**
  String get backToVerify;

  /// No description provided for @verdictPlaceholderNote.
  ///
  /// In en, this message translates to:
  /// **'Receipt preview, share, and retry arrive in Part 2.'**
  String get verdictPlaceholderNote;

  /// No description provided for @statusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get statusPending;

  /// No description provided for @statusVerified.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get statusVerified;

  /// No description provided for @statusFake.
  ///
  /// In en, this message translates to:
  /// **'Fake'**
  String get statusFake;

  /// No description provided for @statusDuplicate.
  ///
  /// In en, this message translates to:
  /// **'Duplicate'**
  String get statusDuplicate;

  /// No description provided for @statusNeedsReview.
  ///
  /// In en, this message translates to:
  /// **'Needs review'**
  String get statusNeedsReview;

  /// No description provided for @statusError.
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get statusError;

  /// No description provided for @viewPlans.
  ///
  /// In en, this message translates to:
  /// **'View plans'**
  String get viewPlans;

  /// No description provided for @verdictVerifiedLabel.
  ///
  /// In en, this message translates to:
  /// **'Payment verified'**
  String get verdictVerifiedLabel;

  /// No description provided for @verdictFakeLabel.
  ///
  /// In en, this message translates to:
  /// **'Fake receipt'**
  String get verdictFakeLabel;

  /// No description provided for @verdictDuplicateLabel.
  ///
  /// In en, this message translates to:
  /// **'Already verified'**
  String get verdictDuplicateLabel;

  /// No description provided for @verdictReviewLabel.
  ///
  /// In en, this message translates to:
  /// **'Under review'**
  String get verdictReviewLabel;

  /// No description provided for @verdictErrorLabel.
  ///
  /// In en, this message translates to:
  /// **'Verification failed'**
  String get verdictErrorLabel;

  /// No description provided for @verdictVerifiedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Paid by {name}'**
  String verdictVerifiedSubtitle(String name);

  /// No description provided for @verdictFakeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'This receipt was not found on the bank\'s server.'**
  String get verdictFakeSubtitle;

  /// No description provided for @verdictDuplicateSubtitle.
  ///
  /// In en, this message translates to:
  /// **'This receipt was already verified on {date}.'**
  String verdictDuplicateSubtitle(String date);

  /// No description provided for @verdictReviewSubtitle.
  ///
  /// In en, this message translates to:
  /// **'A team member will review this receipt within 24 hours.'**
  String get verdictReviewSubtitle;

  /// No description provided for @verdictReviewSupplementarySubtitle.
  ///
  /// In en, this message translates to:
  /// **'We need a clearer photo of this receipt to finish verifying it.'**
  String get verdictReviewSupplementarySubtitle;

  /// No description provided for @verdictReviewFixTitle.
  ///
  /// In en, this message translates to:
  /// **'Retake the receipt'**
  String get verdictReviewFixTitle;

  /// No description provided for @verdictReviewRetakeHint.
  ///
  /// In en, this message translates to:
  /// **'Keep the whole receipt in frame, flat and evenly lit.'**
  String get verdictReviewRetakeHint;

  /// No description provided for @verdictBankLabel.
  ///
  /// In en, this message translates to:
  /// **'Bank'**
  String get verdictBankLabel;

  /// No description provided for @verdictReferenceLabel.
  ///
  /// In en, this message translates to:
  /// **'Reference'**
  String get verdictReferenceLabel;

  /// No description provided for @verdictSenderLabel.
  ///
  /// In en, this message translates to:
  /// **'Sender'**
  String get verdictSenderLabel;

  /// No description provided for @verdictReceiverLabel.
  ///
  /// In en, this message translates to:
  /// **'Receiver'**
  String get verdictReceiverLabel;

  /// No description provided for @verdictPaidAtLabel.
  ///
  /// In en, this message translates to:
  /// **'Paid at'**
  String get verdictPaidAtLabel;

  /// No description provided for @verdictVerifiedAtLabel.
  ///
  /// In en, this message translates to:
  /// **'Verified at'**
  String get verdictVerifiedAtLabel;

  /// No description provided for @verdictDurationLabel.
  ///
  /// In en, this message translates to:
  /// **'Duration'**
  String get verdictDurationLabel;

  /// No description provided for @verdictFirstVerifiedLabel.
  ///
  /// In en, this message translates to:
  /// **'First verified'**
  String get verdictFirstVerifiedLabel;

  /// No description provided for @verdictFirstVerifiedHint.
  ///
  /// In en, this message translates to:
  /// **'Tap to see the original receipt.'**
  String get verdictFirstVerifiedHint;

  /// No description provided for @verdictDurationSeconds.
  ///
  /// In en, this message translates to:
  /// **'{seconds} seconds'**
  String verdictDurationSeconds(String seconds);

  /// No description provided for @verdictDoneButton.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get verdictDoneButton;

  /// No description provided for @verdictTryAgainButton.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get verdictTryAgainButton;

  /// No description provided for @verdictReportButton.
  ///
  /// In en, this message translates to:
  /// **'Report a problem'**
  String get verdictReportButton;

  /// No description provided for @verdictViewOriginalButton.
  ///
  /// In en, this message translates to:
  /// **'View original'**
  String get verdictViewOriginalButton;

  /// No description provided for @verdictViewReceiptButton.
  ///
  /// In en, this message translates to:
  /// **'View receipt'**
  String get verdictViewReceiptButton;

  /// No description provided for @verdictCopySuccess.
  ///
  /// In en, this message translates to:
  /// **'Reference copied'**
  String get verdictCopySuccess;

  /// No description provided for @verdictStillVerifying.
  ///
  /// In en, this message translates to:
  /// **'Still verifying…'**
  String get verdictStillVerifying;

  /// No description provided for @verdictReportTitle.
  ///
  /// In en, this message translates to:
  /// **'Report a problem'**
  String get verdictReportTitle;

  /// No description provided for @verdictReportBody.
  ///
  /// In en, this message translates to:
  /// **'Tell us what is wrong with this verification. Our team will review it.'**
  String get verdictReportBody;

  /// No description provided for @verdictReportReasonHint.
  ///
  /// In en, this message translates to:
  /// **'What is wrong?'**
  String get verdictReportReasonHint;

  /// No description provided for @verdictReportReasonRequired.
  ///
  /// In en, this message translates to:
  /// **'Tell us what is wrong before submitting.'**
  String get verdictReportReasonRequired;

  /// No description provided for @verdictReportSubmitButton.
  ///
  /// In en, this message translates to:
  /// **'Submit report'**
  String get verdictReportSubmitButton;

  /// No description provided for @verdictReportSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Report submitted. We will look into it.'**
  String get verdictReportSubmitted;

  /// No description provided for @verdictCancelButton.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get verdictCancelButton;

  /// No description provided for @verdictReviewNotificationInfo.
  ///
  /// In en, this message translates to:
  /// **'You will be notified when the review is complete.'**
  String get verdictReviewNotificationInfo;

  /// No description provided for @verdictReceiptUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Receipt image unavailable'**
  String get verdictReceiptUnavailable;

  /// No description provided for @verdictReceiptRetry.
  ///
  /// In en, this message translates to:
  /// **'Reload image'**
  String get verdictReceiptRetry;

  /// No description provided for @verdictOriginalUnavailable.
  ///
  /// In en, this message translates to:
  /// **'This receipt belongs to another business.'**
  String get verdictOriginalUnavailable;

  /// No description provided for @verdictErrorBankNotDetected.
  ///
  /// In en, this message translates to:
  /// **'We could not identify the bank on this receipt. Try a clearer photo.'**
  String get verdictErrorBankNotDetected;

  /// No description provided for @verdictErrorBankTimeout.
  ///
  /// In en, this message translates to:
  /// **'The bank\'s server is slow right now. Try again.'**
  String get verdictErrorBankTimeout;

  /// No description provided for @verdictErrorBankUnavailable.
  ///
  /// In en, this message translates to:
  /// **'The bank is unavailable right now. Try again later.'**
  String get verdictErrorBankUnavailable;

  /// No description provided for @verdictErrorOcrEmpty.
  ///
  /// In en, this message translates to:
  /// **'We could not read this receipt. Try a clearer photo.'**
  String get verdictErrorOcrEmpty;

  /// No description provided for @verdictErrorDefault.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Try again.'**
  String get verdictErrorDefault;

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navVerify.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get navVerify;

  /// No description provided for @navTransactions.
  ///
  /// In en, this message translates to:
  /// **'Transactions'**
  String get navTransactions;

  /// No description provided for @navInsights.
  ///
  /// In en, this message translates to:
  /// **'Insights'**
  String get navInsights;

  /// No description provided for @navProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get navProfile;

  /// No description provided for @greetingMorning.
  ///
  /// In en, this message translates to:
  /// **'Good morning, {name}'**
  String greetingMorning(String name);

  /// No description provided for @greetingAfternoon.
  ///
  /// In en, this message translates to:
  /// **'Good afternoon, {name}'**
  String greetingAfternoon(String name);

  /// No description provided for @greetingEvening.
  ///
  /// In en, this message translates to:
  /// **'Good evening, {name}'**
  String greetingEvening(String name);

  /// No description provided for @dashboardWelcomeBack.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get dashboardWelcomeBack;

  /// No description provided for @dashboardBusinessFallback.
  ///
  /// In en, this message translates to:
  /// **'Your business'**
  String get dashboardBusinessFallback;

  /// No description provided for @dashboardCreditsLeft.
  ///
  /// In en, this message translates to:
  /// **'{count} verifications left'**
  String dashboardCreditsLeft(int count);

  /// No description provided for @dashboardUnlimited.
  ///
  /// In en, this message translates to:
  /// **'Unlimited verifications'**
  String get dashboardUnlimited;

  /// No description provided for @dashboardTopUp.
  ///
  /// In en, this message translates to:
  /// **'Top up'**
  String get dashboardTopUp;

  /// No description provided for @dashboardThisMonth.
  ///
  /// In en, this message translates to:
  /// **'This month'**
  String get dashboardThisMonth;

  /// No description provided for @dashboardVerifications.
  ///
  /// In en, this message translates to:
  /// **'Verifications'**
  String get dashboardVerifications;

  /// No description provided for @dashboardRange7.
  ///
  /// In en, this message translates to:
  /// **'Last 7 days'**
  String get dashboardRange7;

  /// No description provided for @dashboardRange30.
  ///
  /// In en, this message translates to:
  /// **'Last 30 days'**
  String get dashboardRange30;

  /// No description provided for @dashboardRange90.
  ///
  /// In en, this message translates to:
  /// **'Last 90 days'**
  String get dashboardRange90;

  /// No description provided for @dashboardRange365.
  ///
  /// In en, this message translates to:
  /// **'Last 12 months'**
  String get dashboardRange365;

  /// No description provided for @dashboardQuickVerifyTitle.
  ///
  /// In en, this message translates to:
  /// **'Verify a payment'**
  String get dashboardQuickVerifyTitle;

  /// No description provided for @dashboardQuickVerifyBody.
  ///
  /// In en, this message translates to:
  /// **'Scan a bank receipt'**
  String get dashboardQuickVerifyBody;

  /// No description provided for @dashboardQuickHistoryTitle.
  ///
  /// In en, this message translates to:
  /// **'Transactions'**
  String get dashboardQuickHistoryTitle;

  /// No description provided for @dashboardQuickHistoryBody.
  ///
  /// In en, this message translates to:
  /// **'Every verification in one place'**
  String get dashboardQuickHistoryBody;

  /// No description provided for @dashboardRecentTitle.
  ///
  /// In en, this message translates to:
  /// **'Recent activity'**
  String get dashboardRecentTitle;

  /// No description provided for @dashboardSeeAll.
  ///
  /// In en, this message translates to:
  /// **'See all'**
  String get dashboardSeeAll;

  /// No description provided for @dashboardEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No verifications yet'**
  String get dashboardEmptyTitle;

  /// No description provided for @dashboardEmptyBody.
  ///
  /// In en, this message translates to:
  /// **'Verified payments will appear here.'**
  String get dashboardEmptyBody;

  /// No description provided for @dashboardStaleBanner.
  ///
  /// In en, this message translates to:
  /// **'Some of this data couldn\'t load. Tap to retry.'**
  String get dashboardStaleBanner;

  /// No description provided for @dashboardErrorBody.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t load your dashboard.'**
  String get dashboardErrorBody;

  /// No description provided for @dashboardNotifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get dashboardNotifications;

  /// No description provided for @dashboardInboxSoon.
  ///
  /// In en, this message translates to:
  /// **'Your inbox arrives in Step 26.'**
  String get dashboardInboxSoon;

  /// No description provided for @dashboardBillingSoon.
  ///
  /// In en, this message translates to:
  /// **'Billing arrives in Step 25.'**
  String get dashboardBillingSoon;

  /// No description provided for @shellComingSoon.
  ///
  /// In en, this message translates to:
  /// **'Coming soon'**
  String get shellComingSoon;

  /// No description provided for @shellHistoryBody.
  ///
  /// In en, this message translates to:
  /// **'Full transaction history arrives in Step 24.'**
  String get shellHistoryBody;

  /// No description provided for @shellInsightsBody.
  ///
  /// In en, this message translates to:
  /// **'Insights arrive in Step 26.'**
  String get shellInsightsBody;

  /// No description provided for @shellProfileBody.
  ///
  /// In en, this message translates to:
  /// **'Profile and settings arrive in Step 27.'**
  String get shellProfileBody;

  /// No description provided for @relativeTimeJustNow.
  ///
  /// In en, this message translates to:
  /// **'Just now'**
  String get relativeTimeJustNow;

  /// No description provided for @relativeTimeMinutes.
  ///
  /// In en, this message translates to:
  /// **'{count}m ago'**
  String relativeTimeMinutes(int count);

  /// No description provided for @relativeTimeHours.
  ///
  /// In en, this message translates to:
  /// **'{count}h ago'**
  String relativeTimeHours(int count);

  /// No description provided for @relativeTimeYesterday.
  ///
  /// In en, this message translates to:
  /// **'Yesterday'**
  String get relativeTimeYesterday;

  /// No description provided for @relativeTimeDays.
  ///
  /// In en, this message translates to:
  /// **'{count}d ago'**
  String relativeTimeDays(int count);
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
