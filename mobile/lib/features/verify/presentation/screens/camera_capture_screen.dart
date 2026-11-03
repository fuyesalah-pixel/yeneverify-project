// Full-screen camera capture (Step 22B Part 1).
//
// Returns the captured [File] via Navigator.pop; the verify screen feeds it
// straight into the pipeline.
//
// EMULATOR NOTE: the Android emulator exposes a synthetic camera (moving
// checkerboard) or no camera at all, depending on AVD config. This screen
// therefore treats "no cameras" as a normal, expected outcome and shows the
// "use Upload image instead" fallback rather than throwing. Real capture is
// verified on a physical device (Step 23 target).
//
// PERMISSIONS: camera permission is requested here, on first open, not at
// app start — a prompt without context is the main reason users deny it.
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';

/// Why the camera could not start. Distinguishes "user said no" (recoverable
/// via settings) from "this device has no camera" (use the gallery instead).
enum _CameraProblem { permission, unavailable }

class CameraCaptureScreen extends StatefulWidget {
  const CameraCaptureScreen({super.key});

  @override
  State<CameraCaptureScreen> createState() => _CameraCaptureScreenState();
}

class _CameraCaptureScreenState extends State<CameraCaptureScreen> {
  List<CameraDescription> _cameras = const [];
  CameraController? _controller;
  int _cameraIndex = 0;
  bool _initializing = true;
  _CameraProblem? _problem;
  XFile? _captured;
  FlashMode _flashMode = FlashMode.off;
  bool _capturing = false;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    final status = await Permission.camera.request();
    if (!mounted) return;

    if (!status.isGranted) {
      setState(() {
        _initializing = false;
        _problem = _CameraProblem.permission;
      });
      return;
    }

    try {
      _cameras = await availableCameras();
    } catch (_) {
      _cameras = const [];
    }
    if (!mounted) return;

    if (_cameras.isEmpty) {
      setState(() {
        _initializing = false;
        _problem = _CameraProblem.unavailable;
      });
      return;
    }

    await _startController(_cameras[_cameraIndex]);
  }

  Future<void> _startController(CameraDescription description) async {
    final previous = _controller;
    _controller = null;
    await previous?.dispose();

    final controller = CameraController(
      description,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );

    try {
      await controller.initialize();
      await controller.setFlashMode(_flashMode);
    } on CameraException {
      await controller.dispose();
      if (!mounted) return;
      setState(() {
        _initializing = false;
        _problem = _CameraProblem.unavailable;
      });
      return;
    }

    if (!mounted) {
      await controller.dispose();
      return;
    }
    setState(() {
      _controller = controller;
      _initializing = false;
      _problem = null;
    });
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _takePicture() async {
    final controller = _controller;
    if (controller == null || _capturing || !controller.value.isInitialized) {
      return;
    }
    setState(() => _capturing = true);
    try {
      final shot = await controller.takePicture();
      if (!mounted) return;
      setState(() {
        _captured = shot;
        _capturing = false;
      });
    } on CameraException {
      if (!mounted) return;
      setState(() => _capturing = false);
    }
  }

  Future<void> _toggleFlash() async {
    final controller = _controller;
    final next =
        _flashMode == FlashMode.off ? FlashMode.torch : FlashMode.off;
    setState(() => _flashMode = next);
    try {
      await controller?.setFlashMode(next);
    } on CameraException {
      // Torch is unsupported on some emulators — keep the preview usable.
    }
  }

  Future<void> _switchCamera() async {
    if (_cameras.length < 2) return;
    setState(() {
      _cameraIndex = (_cameraIndex + 1) % _cameras.length;
      _initializing = true;
      _captured = null;
    });
    await _startController(_cameras[_cameraIndex]);
  }

  void _usePhoto() {
    final shot = _captured;
    if (shot == null) return;
    Navigator.of(context).pop(File(shot.path));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(child: _preview(l10n)),
            Positioned(
              top: AppSpacing.sm,
              left: AppSpacing.sm,
              child: _RoundIconButton(
                icon: Icons.close,
                tooltip: l10n.closeLabel,
                onTap: () => Navigator.of(context).pop(),
              ),
            ),
            if (_captured == null && _problem == null)
              Positioned(
                left: 0,
                right: 0,
                bottom: AppSpacing.xxxl,
                child: _captureControls(l10n),
              ),
            if (_captured != null)
              Positioned(
                left: 0,
                right: 0,
                bottom: AppSpacing.xxxl,
                child: _reviewControls(l10n),
              ),
          ],
        ),
      ),
    );
  }

  Widget _preview(AppLocalizations l10n) {
    if (_problem != null) return _problemView(l10n);

    final captured = _captured;
    if (captured != null) {
      // Frozen frame: the user reviews exactly what will be uploaded.
      return Image.file(File(captured.path), fit: BoxFit.contain);
    }

    final controller = _controller;
    if (_initializing || controller == null || !controller.value.isInitialized) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }

    final size = controller.value.previewSize;
    if (size == null) return CameraPreview(controller);

    // previewSize is reported in sensor (landscape) orientation, so the
    // preview box is width=size.height, height=size.width.
    return SizedBox.expand(
      child: FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: size.height,
          height: size.width,
          child: CameraPreview(controller),
        ),
      ),
    );
  }

  Widget _problemView(AppLocalizations l10n) {
    final isPermission = _problem == _CameraProblem.permission;
    return Container(
      color: Colors.black,
      padding: const EdgeInsets.all(AppSpacing.xxl),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.no_photography_outlined,
                size: 56, color: Colors.white),
            const SizedBox(height: AppSpacing.lg),
            Text(
              isPermission ? l10n.cameraAccessNeeded : l10n.cameraNotAvailable,
              style: AppTypography.headingSmall
                  .copyWith(color: Colors.white),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              isPermission ? l10n.cameraAccessBody : l10n.galleryUnavailable,
              style: AppTypography.bodySmall.copyWith(
                color: Colors.white.withValues(alpha: 0.75),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xxl),
            if (isPermission)
              AppButton(
                label: l10n.openSettings,
                onPressed: openAppSettings,
              ),
            const SizedBox(height: AppSpacing.sm),
            AppButton(
              label: l10n.backToVerify,
              variant: AppButtonVariant.secondary,
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _captureControls(AppLocalizations l10n) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _RoundIconButton(
          icon: _flashMode == FlashMode.off
              ? Icons.flash_off_outlined
              : Icons.flash_on_outlined,
          tooltip: l10n.toggleFlash,
          onTap: _toggleFlash,
        ),
        GestureDetector(
          onTap: _takePicture,
          child: Semantics(
            button: true,
            label: l10n.takePhoto,
            child: Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 4),
                color: _capturing
                    ? Colors.white.withValues(alpha: 0.4)
                    : AppColors.transparent,
              ),
              child: _capturing
                  ? const Padding(
                      padding: EdgeInsets.all(AppSpacing.lg),
                      child: CircularProgressIndicator(color: Colors.white),
                    )
                  : null,
            ),
          ),
        ),
        _RoundIconButton(
          icon: Icons.cameraswitch_outlined,
          tooltip: l10n.switchCamera,
          onTap: _cameras.length > 1 ? _switchCamera : null,
        ),
      ],
    );
  }

  Widget _reviewControls(AppLocalizations l10n) {
    return Padding(
      padding: AppSpacing.screenH,
      child: Row(
        children: [
          Expanded(
            child: AppButton(
              label: l10n.retakePhoto,
              variant: AppButtonVariant.secondary,
              onPressed: () => setState(() => _captured = null),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: AppButton(label: l10n.usePhoto, onPressed: _usePhoto),
          ),
        ],
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    required this.icon,
    required this.tooltip,
    this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      tooltip: tooltip,
      icon: Icon(icon, color: Colors.white),
      style: IconButton.styleFrom(
        backgroundColor: Colors.black.withValues(alpha: 0.35),
      ),
    );
  }
}
