// Device account paired to this device via Google Sign-In.
// Contract: backend/src/google-auth/dto/google-auth.dto.ts DeviceAccountSchema.
class DeviceAccount {
  const DeviceAccount({
    required this.phoneLast4,
    required this.googleEmail,
  });

  final String phoneLast4;
  final String googleEmail;

  factory DeviceAccount.fromJson(Map<String, dynamic> json) => DeviceAccount(
        phoneLast4: json['phoneLast4'] as String,
        googleEmail: json['googleEmail'] as String,
      );

  Map<String, dynamic> toJson() => {
        'phoneLast4': phoneLast4,
        'googleEmail': googleEmail,
      };

  @override
  String toString() => 'DeviceAccount(phoneLast4: $phoneLast4, googleEmail: $googleEmail)';
}
