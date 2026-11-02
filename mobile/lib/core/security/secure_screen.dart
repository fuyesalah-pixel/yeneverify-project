import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Enables Android's `FLAG_SECURE` while an auth screen is mounted, which
/// blocks screenshots and screen recording of PIN entry. On platforms without
/// the channel the call is a no-op, so this is safe in tests.
class SecureScreen extends StatefulWidget {
  const SecureScreen({super.key, required this.child});

  final Widget child;

  @override
  State<SecureScreen> createState() => _SecureScreenState();
}

class _SecureScreenState extends State<SecureScreen> {
  static const _channel = MethodChannel('yene_verify/security');

  @override
  void initState() {
    super.initState();
    _setSecure(true);
  }

  @override
  void dispose() {
    _setSecure(false);
    super.dispose();
  }

  void _setSecure(bool enabled) {
    // Fire-and-forget: a missing/unsupported channel must never break auth.
    _channel.invokeMethod<void>('setSecureFlag', enabled).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
