/// POST /sub-merchants/invite body.
class InviteRequest {
  const InviteRequest({
    required this.phone,
    this.name,
    this.branchLabel,
  });

  /// E.164 Ethiopian number (+2519XXXXXXXX).
  final String phone;
  final String? name;
  final String? branchLabel;

  Map<String, dynamic> toJson() => {
        'phone': phone,
        if (name != null && name!.trim().isNotEmpty) 'name': name!.trim(),
        if (branchLabel != null && branchLabel!.trim().isNotEmpty)
          'branchLabel': branchLabel!.trim(),
      };
}
