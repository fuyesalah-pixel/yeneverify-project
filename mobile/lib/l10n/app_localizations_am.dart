// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Amharic (`am`).
class AppLocalizationsAm extends AppLocalizations {
  AppLocalizationsAm([String locale = 'am']) : super(locale);

  @override
  String get appName => 'ዬን ቨሪፋይ';

  @override
  String get loginTitle => 'ዬን ቨሪፋይ';

  @override
  String get loginSubtitle => 'ለመጀመር የስልክ ቁጥርዎን ያስገቡ';

  @override
  String get taglinePrimary => 'ማንኛውንም የኢትዮጵያ ባንክ ክፍያ ያረጋግጡ። በሰከንዶች።';

  @override
  String get taglineShort => 'ያረጋግጡ። ይምኑ። ያድጉ።';

  @override
  String get continueLabel => 'ቀጥል';

  @override
  String get cancelLabel => 'ሰርዝ';

  @override
  String get confirmLabel => 'አረጋግጥ';

  @override
  String get saveLabel => 'አስቀምጥ';

  @override
  String get deleteLabel => 'ሰርዝ';

  @override
  String get retryLabel => 'እንደገና ሞክር';

  @override
  String get okLabel => 'እሺ';

  @override
  String get closeLabel => 'ዝጋ';

  @override
  String get backLabel => 'ተመለስ';

  @override
  String get doneLabel => 'ተጠናቀቀ';

  @override
  String get loadingLabel => 'በመጫን ላይ…';

  @override
  String get requiredField => 'ይህ መስክ ያስፈልጋል';

  @override
  String get genericError => 'ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።';

  @override
  String get networkError => 'የኢንተርኔት ግንኙነት የለም። ኔትወርክዎን ያረጋግጡ።';

  @override
  String get sessionExpired => 'ክፍለ ጊዜዎ ጊዜው አልፏል። እንደገና ይግቡ።';

  @override
  String get phoneNumber => 'ስልክ ቁጥር';

  @override
  String get phoneHint => '+251 9XX XXX XXX';

  @override
  String get phoneInvalid => 'የሚሰራ የኢትዮጵያ ስልክ ቁጥር ያስገቡ';

  @override
  String get otpTitle => 'የማረጋገጫ ኮድ ያስገቡ';

  @override
  String otpSubtitle(String phone) {
    return 'ወደ $phone 6 አሃዝ ኮድ ልከናል';
  }

  @override
  String get otpResend => 'ኮድ እንደገና ላክ';

  @override
  String otpResendIn(int seconds) {
    return 'በ$seconds ሰከንድ ውስጥ እንደገና ላክ';
  }

  @override
  String get otpInvalid => 'ኮዱ ስህተት ነው። እንደገና ይሞክሩ።';

  @override
  String get otpExpired => 'ኮዱ ጊዜው አልፏል። አዲስ ኮድ ይጠይቁ።';

  @override
  String get pinIncorrect => 'የPIN ኮድ ስህተት ነው። እንደገና ይሞክሩ።';

  @override
  String pinLocked(int minutes) {
    return 'በጣም ብዙ ሙከራዎች። እንደገና በ$minutes ደቂቃ ውስጥ ይሞክሩ።';
  }

  @override
  String get errorDeviceLimit => 'በጣም ብዙ መሳሪያዎች። ከቅንብሮች ውስጥ አንዱን ያስወግዱ።';

  @override
  String get errorAccountBanned => 'ይህ መለያ ታግዷል። ድጋፍን ያግኙ።';

  @override
  String get pinSetupTitle => 'PIN ይፍጠሩ';

  @override
  String get pinSetupSubtitle => 'Yene Verify ን በየጊዜው ሲከፍቱ ይህን PIN ይጠቀሙ';

  @override
  String get pinEntryTitle => 'እንኳን ደህና መጡ';

  @override
  String get pinEntryForgot => 'PIN ረስዋል?';

  @override
  String get otpMaxAttempts => 'ብዙ ሙከራዎች። ከጥቂት ጊዜ በኋላ እንደገና ይሞክሩ።';

  @override
  String get pinTitle => 'PIN ያቀናብሩ';

  @override
  String pinSubtitle(int length) {
    return 'መለያዎን ለመጠበቅ $length አሃዝ PIN ይምረጡ';
  }

  @override
  String get pinConfirmTitle => 'PIN ያረጋግጡ';

  @override
  String get pinMismatch => 'PINs አይዛመዱም። እንደገና ይሞክሩ።';

  @override
  String pinWrong(int attemptsLeft) {
    return 'PIN ትክክል አይደለም። $attemptsLeft ሙከራ ቀርቷል።';
  }

  @override
  String get enterPin => 'PINዎን ያስገቡ';

  @override
  String get biometricTitle => 'ባዮሜትሪክ መክፈቻ አንቃ';

  @override
  String get biometricSubtitle =>
      'በፍጥነት እና ደህንነቱ በተጠበቀ ሁኔታ ለመክፈት የጣት አሻራ ወይም Face ID ይጠቀሙ።';

  @override
  String get biometricEnable => 'ባዮሜትሪክ አንቃ';

  @override
  String get biometricSkip => 'አሁን ዝለል';

  @override
  String get biometricPrompt => 'ማንነትዎን ያረጋግጡ';

  @override
  String get biometricFailed => 'ባዮሜትሪክ ማረጋገጥ አልተሳካም። PINዎን ይጠቀሙ።';

  @override
  String get verifyTitle => 'ክፍያ ያረጋግጡ';

  @override
  String get verifySubtitle => 'የደንበኛውን የክፍያ ማረጋገጫ ፎቶ ያንሱ ወይም ይስቀሉ።';

  @override
  String get takePhoto => 'ፎቶ አንሳ';

  @override
  String get uploadImage => 'ምስል ስቀል';

  @override
  String get choosePhotoSource => 'የደረሰኝ ፎቶ አክል';

  @override
  String get takePhotoDescription => 'የክፍያ ማረጋገጫ ስክሪኑን ያንሱ';

  @override
  String get uploadImageDescription => 'ከማዕከለ-ስዕሎት ያለ ፎቶ ይምረጡ';

  @override
  String get verificationPending => 'በማረጋገጥ ላይ…';

  @override
  String verificationPendingDetail(String bank) {
    return 'ደረሰኙን ከ$bank ጋር እየፈተሽን ነው። ይህ ከ10 ሰከንድ ያነሰ ጊዜ ይወስዳል።';
  }

  @override
  String get verdictVerified => 'ተረጋግጧል';

  @override
  String get verdictFake => 'ውሸት';

  @override
  String get verdictDuplicate => 'ተባዝቷል';

  @override
  String get verdictPending => 'በጥበቃ ላይ';

  @override
  String get verdictNeedsReview => 'ግምገማ';

  @override
  String get verdictError => 'ስህተት';

  @override
  String get verdictVerifiedMessage => 'ይህ ደረሰኝ ትክክለኛ ነው።';

  @override
  String get verdictFakeMessage => 'ይህ ደረሰኝ ሊረጋገጥ አልቻለም። ሐሰተኛ ሊሆን ይችላል።';

  @override
  String verdictDuplicateMessage(String date) {
    return 'ይህ ደረሰኝ ቀደም ሲል $date ተረጋግጧል።';
  }

  @override
  String verdictErrorMessage(String bank) {
    return 'አሁን ወደ $bank ማዳረስ አልተቻለም። እንደገና ይሞክሩ።';
  }

  @override
  String get transactionReference => 'የግብይት ማጣቀሻ';

  @override
  String get transactionAmount => 'መጠን';

  @override
  String get transactionDate => 'ቀን';

  @override
  String get transactionBank => 'ባንክ';

  @override
  String get transactionSender => 'ላኪ';

  @override
  String get transactionReceiver => 'ተቀባይ';

  @override
  String get transactionsTitle => 'ግብይቶች';

  @override
  String get noTransactionsTitle => 'ምንም ማረጋገጫ የለም';

  @override
  String get noTransactionsBody => 'የተረጋገጡ ክፍያዎች እዚህ ይታያሉ።';

  @override
  String get verifyFirst => 'ክፍያ ያረጋግጡ';

  @override
  String get homeTitle => 'መነሻ';

  @override
  String get analyticsTitle => 'ትንታኔ';

  @override
  String get profileTitle => 'መገለጫ';

  @override
  String get settingsTitle => 'ቅንብሮች';

  @override
  String get historyTitle => 'ታሪክ';

  @override
  String get subMerchantsTitle => 'ቡድን';

  @override
  String get addSubMerchant => 'የቡድን አባል አክል';

  @override
  String get noSubMerchantsTitle => 'ምንም የቡድን አባላት የሉም';

  @override
  String get noSubMerchantsBody => 'ካሽ ሰጭዎችን ወይም ቅርንጫፍ ሰራተኞችን ክፍያ ለማረጋገጥ ያክሉ።';

  @override
  String creditsRemaining(int count) {
    return '$count ክሬዲቶች ቀርተዋል';
  }

  @override
  String creditsLow(int count) {
    return 'ትንሽ ክሬዲቶች ብቻ ቀርተዋል ($count)። ጥቅሉን ያድሱ።';
  }

  @override
  String get creditsEmpty => 'ደረሰኞችን ማረጋገጥ ለመቀጠል ጥቅሉን ያድሱ።';

  @override
  String get creditsUnlimited => 'ያልተገደበ';

  @override
  String get renewPackage => 'ጥቅሉን አድስ';

  @override
  String get billingTitle => 'ደንበኝነት';

  @override
  String get billingCurrentPlan => 'አሁን ያለው እቅድ';

  @override
  String billingPaymentInstructions(String amount) {
    return '$amount ወደ ታች ወዳለው መለያ ያስተላልፉ፣ ከዚያም የክፍያ ስክሪን ፎቶ ይስቀሉ።';
  }

  @override
  String get billingUploadProof => 'የክፍያ ማረጋገጫ ስቀል';

  @override
  String get billingVerifying => 'ክፍያዎን እያረጋገጥን…';

  @override
  String get billingSuccess => 'ክፍያ ተረጋግጧል። እቅድዎ አሁን ነቅቷል።';

  @override
  String get billingFailed => 'ክፍያ ሊረጋገጥ አልቻለም። ድጋፍ ያግኙ።';

  @override
  String get billingNeedsReview => 'ክፍያዎ በግምገማ ላይ ነው። በቅርቡ እናሳውቅዎታለን።';

  @override
  String get planFree => 'ነፃ';

  @override
  String get planPremium => 'ፕሪሚየም';

  @override
  String get planBusiness => 'ቢዝነስ';

  @override
  String get planBusinessPro => 'ቢዝነስ ፕሮ';

  @override
  String get planApiIntegration => 'API ውህደት';

  @override
  String planVerificationsPerMonth(int count) {
    return '$count ማረጋገጫዎች / ወር';
  }

  @override
  String get planUnlimitedVerifications => 'ያልተገደበ ማረጋገጫዎች';

  @override
  String get notificationsTitle => 'ማሳወቂያዎች';

  @override
  String get noNotificationsTitle => 'ሁሉም ወቅታዊ ነው';

  @override
  String get noNotificationsBody => 'አዲስ ማሳወቂያዎች የሉም።';

  @override
  String get logoutLabel => 'ውጣ';

  @override
  String get logoutConfirmTitle => 'ይወጡ?';

  @override
  String get logoutConfirmBody => 'ለመግባት ማንነትዎን ማረጋገጥ ያስፈልግዎታል።';

  @override
  String get devicesTitle => 'የታመኑ መሳሪያዎች';

  @override
  String get deviceThisDevice => 'ይህ መሳሪያ';

  @override
  String get deviceRevoke => 'መሳሪያ አስወግድ';

  @override
  String get deviceRevokeConfirm => 'ይህን መሳሪያ ያስወግዱ? ዳግም ማረጋገጥ ያስፈልጋል።';

  @override
  String get businessName => 'የንግድ ስም';

  @override
  String get businessType => 'የንግድ ዓይነት';

  @override
  String get fullName => 'ሙሉ ስም';

  @override
  String get language => 'ቋንቋ';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageAmharic => 'አማርኛ';

  @override
  String get darkMode => 'ጨለማ ሁነታ';

  @override
  String appVersion(String version) {
    return 'ስሪት $version';
  }

  @override
  String get copyReference => 'ማጣቀሻ ቅዳ';

  @override
  String get copied => 'ተቀድቷል!';

  @override
  String get shareLabel => 'አጋራ';

  @override
  String get exportLabel => 'ወደ ውጭ ላክ';

  @override
  String get filterLabel => 'አጣራ';

  @override
  String get searchLabel => 'ፈልግ';

  @override
  String get searchHint => 'ግብይቶችን ፈልግ…';

  @override
  String noSearchResults(String query) {
    return 'ለ\"$query\" ምንም ውጤት የለም';
  }

  @override
  String get dateRangeLabel => 'የቀን ክልል';

  @override
  String get bankLabel => 'ባንክ';

  @override
  String get allBanks => 'ሁሉም ባንኮች';

  @override
  String get bankCbe => 'የኢትዮጵያ ንግድ ባንክ';

  @override
  String get bankTelebirr => 'ቴሌብር';

  @override
  String get bankAwash => 'ዓዋሽ ባንክ';

  @override
  String get bankDashen => 'ዳሸን ባንክ';

  @override
  String get bankAbyssinia => 'አቢሲኒያ ባንክ';

  @override
  String get bankMpesa => 'M-Pesa';

  @override
  String get bankZemen => 'ዘመን ባንክ';

  @override
  String get insightsTitle => 'ግንዛቤዎች';

  @override
  String get insightBestProducts => 'ምርጥ ሸቀጦች';

  @override
  String get insightPeakHours => 'ከፍተኛ ሰዓቶች';

  @override
  String get insightBestDays => 'ምርጥ ቀናት';

  @override
  String get insightTrend => 'አዝማሚያ';

  @override
  String get insightRecommendations => 'ምክሮች';

  @override
  String get insightAnomalies => 'ያልተለመዱ ሁኔታዎች';

  @override
  String get noInsightsTitle => 'በቂ ዳታ የለም';

  @override
  String get noInsightsBody => 'ግንዛቤዎችን ለማግኘት ተጨማሪ ማረጋገጫዎችን ያጠናቅቁ።';

  @override
  String trendUp(String percent, String period) {
    return '+$percent% ካለፈው $period ጋር ሲነጻጸር';
  }

  @override
  String trendDown(String percent, String period) {
    return '-$percent% ካለፈው $period ጋር ሲነጻጸር';
  }

  @override
  String get periodWeek => 'ሳምንት';

  @override
  String get periodMonth => 'ወር';

  @override
  String get auditLogTitle => 'የኦዲት ምዝገባ';

  @override
  String get permissionCameraTitle => 'የካሜራ ፈቃድ ያስፈልጋል';

  @override
  String get permissionCameraBody =>
      'ዬን ቨሪፋይ የክፍያ ፎቶዎችን ለማንሳት የካሜራ ፈቃድ ያስፈልገዋል።';

  @override
  String get permissionGalleryTitle => 'የፎቶ ማዕከለ-ስዕሎት ፈቃድ ያስፈልጋል';

  @override
  String get permissionGalleryBody =>
      'ዬን ቨሪፋይ ፎቶዎችን ለመስቀል የፎቶ ማዕከለ-ስዕሎት ፈቃድ ያስፈልገዋል።';

  @override
  String get permissionOpenSettings => 'ቅንብሮች ክፈት';

  @override
  String get onboardingStep1Title => 'ክፍያዎችን ወዲያውኑ ያረጋግጡ';

  @override
  String get onboardingStep1Body =>
      'ማንኛውንም የኢትዮጵያ ባንክ ደረሰኝ ፎቶ ያንሱ እና ውጤቱን በ10 ሰከንድ ያነሰ ጊዜ ያግኙ።';

  @override
  String get onboardingStep2Title => 'የክፍያ ማጭበርበርን ያስቁ';

  @override
  String get onboardingStep2Body =>
      'ተመሳሳይ ደረሰኝ ሁለት ጊዜ ጥቅም ላይ ከዋለ ቢዝነስዎን የሚከላከለው የድብልቅ ደረሰኝ ፍለጋ።';

  @override
  String get onboardingStep3Title => 'በግንዛቤዎች ያድጉ';

  @override
  String get onboardingStep3Body =>
      'ከፍተኛ ሰዓቶችዎን፣ ምርጥ ምርቶችዎን እና የሽያጭ አዝማሚያዎችዎን ያውቁ።';

  @override
  String get getStarted => 'ጀምር';

  @override
  String get learnMoreLabel => 'ተጨማሪ ይወቁ';

  @override
  String get authComingSoon => 'የምስገት ፍሰት — በStep 21 ይመጣል';

  @override
  String get debugDesignSystem => 'ዴበግ: የንድፍ ስርዓት';
}
