import 'package:flutter/material.dart';

import '../../theme/app_colors_extension.dart';

/// Camera framing overlay inspired by the supplied scan design.
///
/// It is purely decorative: capture, permission and image handling stay in the
/// screen. Corner brackets and a slow scan line give the camera a branded,
/// focused feel without changing the crop or the uploaded pixels.
class BrandScanOverlay extends StatefulWidget {
  const BrandScanOverlay({super.key});

  @override
  State<BrandScanOverlay> createState() => _BrandScanOverlayState();
}

class _BrandScanOverlayState extends State<BrandScanOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller
        ..stop()
        ..value = 0.5;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => CustomPaint(
          painter: _ScanFramePainter(
            progress: _controller.value,
            accent: colors.primaryAction,
            highlight: colors.brandAccent,
            scrim: colors.overlay.withValues(alpha: 0.24),
          ),
          child: const SizedBox.expand(),
        ),
      ),
    );
  }
}

class _ScanFramePainter extends CustomPainter {
  _ScanFramePainter({
    required this.progress,
    required this.accent,
    required this.highlight,
    required this.scrim,
  });

  final double progress;
  final Color accent;
  final Color highlight;
  final Color scrim;

  @override
  void paint(Canvas canvas, Size size) {
    final frameWidth = size.width * 0.72;
    final frameHeight = frameWidth * 1.16;
    final left = (size.width - frameWidth) / 2;
    final top = (size.height - frameHeight) / 2 - size.height * 0.04;
    final frame = Rect.fromLTWH(left, top, frameWidth, frameHeight);
    final radius = Radius.circular(frameWidth * 0.08);

    final scrimPath = Path()
      ..addRect(Offset.zero & size)
      ..addRRect(RRect.fromRectAndRadius(frame, radius))
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(scrimPath, Paint()..color = scrim);

    final borderPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = highlight.withValues(alpha: 0.28);
    canvas.drawRRect(
      RRect.fromRectAndRadius(frame, radius),
      borderPaint,
    );

    final cornerPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round
      ..color = accent;
    final corner = frameWidth * 0.16;
    const inset = 2.0;

    // Top-left
    canvas.drawPath(
      Path()
        ..moveTo(frame.left + inset, frame.top + corner)
        ..lineTo(frame.left + inset, frame.top + radius.y + inset)
        ..quadraticBezierTo(
          frame.left + inset,
          frame.top + inset,
          frame.left + radius.x + inset,
          frame.top + inset,
        )
        ..lineTo(frame.left + corner, frame.top + inset),
      cornerPaint,
    );
    // Top-right
    canvas.drawPath(
      Path()
        ..moveTo(frame.right - corner, frame.top + inset)
        ..lineTo(frame.right - radius.x - inset, frame.top + inset)
        ..quadraticBezierTo(
          frame.right - inset,
          frame.top + inset,
          frame.right - inset,
          frame.top + radius.y + inset,
        )
        ..lineTo(frame.right - inset, frame.top + corner),
      cornerPaint,
    );
    // Bottom-left
    canvas.drawPath(
      Path()
        ..moveTo(frame.left + inset, frame.bottom - corner)
        ..lineTo(frame.left + inset, frame.bottom - radius.y - inset)
        ..quadraticBezierTo(
          frame.left + inset,
          frame.bottom - inset,
          frame.left + radius.x + inset,
          frame.bottom - inset,
        )
        ..lineTo(frame.left + corner, frame.bottom - inset),
      cornerPaint,
    );
    // Bottom-right
    canvas.drawPath(
      Path()
        ..moveTo(frame.right - corner, frame.bottom - inset)
        ..lineTo(frame.right - radius.x - inset, frame.bottom - inset)
        ..quadraticBezierTo(
          frame.right - inset,
          frame.bottom - inset,
          frame.right - inset,
          frame.bottom - radius.y - inset,
        )
        ..lineTo(frame.right - inset, frame.bottom - corner),
      cornerPaint,
    );

    final scanY = frame.top + frameHeight * (0.14 + (progress * 0.72));
    final scanRect = Rect.fromLTWH(
      frame.left + frameWidth * 0.08,
      scanY - 1.5,
      frameWidth * 0.84,
      3,
    );
    final scanPaint = Paint()
      ..shader = LinearGradient(
        colors: [
          highlight.withValues(alpha: 0),
          highlight,
          highlight.withValues(alpha: 0),
        ],
      ).createShader(scanRect)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);
    canvas.drawRRect(
      RRect.fromRectAndRadius(scanRect, const Radius.circular(2)),
      scanPaint,
    );
  }

  @override
  bool shouldRepaint(_ScanFramePainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.accent != accent ||
      oldDelegate.highlight != highlight ||
      oldDelegate.scrim != scrim;
}
