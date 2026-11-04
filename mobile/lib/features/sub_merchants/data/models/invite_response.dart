/// POST /sub-merchants/invite and /sub-merchants/invites/:id/resend.
///
/// The invite endpoint returns the full payload; resend returns only
/// `{ smsSent }`, so every field except [smsSent] is optional.
class InviteResponse {
  const InviteResponse({
    this.inviteId,
    this.expiresAt,
    this.inviteUrl,
    this.smsSent = false,
  });

  final String? inviteId;
  final DateTime? expiresAt;
  final String? inviteUrl;
  final bool smsSent;

  factory InviteResponse.fromJson(Map<String, dynamic> json) {
    return InviteResponse(
      inviteId: json['inviteId'] as String?,
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? ''),
      inviteUrl: json['inviteUrl'] as String?,
      smsSent: json['smsSent'] == true,
    );
  }
}
