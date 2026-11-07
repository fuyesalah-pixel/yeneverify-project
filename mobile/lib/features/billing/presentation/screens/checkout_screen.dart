// /billing/checkout/:sessionId — two steps: payment instructions, then the
// screenshot upload. The session itself was opened by BillingScreen and
// travels in `extra`; only its id is in the URL.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/network/api_result.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/feedback/app_snackbar.dart';
import '../../../../core/widgets/layout/app_error_state.dart';
import '../../../../core/widgets/fintech/photo_source_picker.dart';
import '../../../verify/data/image_source_service.dart';
import '../../../verify/data/receipts_api.dart';
import '../../data/models/billing_session.dart';
import '../../domain/package_display.dart';
import '../providers/checkout_provider.dart';
import '../widgets/payment_instructions_card.dart';
import '../widgets/receipt_upload_section.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key, required this.session});

  final BillingSession? session;

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  InputMethod _inputMethod = InputMethod.upload;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final session = widget.session;

    if (session == null) {
      return Scaffold(
        backgroundColor: colors.background,
        appBar: AppBar(),
        body: Center(
          child: Padding(
            padding: AppSpacing.screenH,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AppErrorState(
                  message: l10n.billingSessionExpired,
                  compact: true,
                ),
                const SizedBox(height: AppSpacing.lg),
                AppButton(
                  label: l10n.billingBack,
                  variant: AppButtonVariant.secondary,
                  onPressed: () => Navigator.of(context).maybePop(),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final async = ref.watch(checkoutProvider(session.packageCode));
    final state = async.valueOrNull;
    final step = state?.stage == CheckoutStage.instructions
        ? l10n.billingPayFor(session.packageName)
        : l10n.billingUploadHeading;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(step)),
      body: SafeArea(
        child: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => AppErrorState(
            message: error is ApiError
                ? error.userFacingMessage(l10n)
                : l10n.genericError,
            onRetry: () =>
                ref.invalidate(checkoutProvider(session.packageCode)),
            retryLabel: l10n.retryLabel,
          ),
          data: (value) => value.stage == CheckoutStage.instructions
              ? _Instructions(
                  session: session,
                  onPaid: () => ref
                      .read(checkoutProvider(session.packageCode).notifier)
                      .showUploadStep(),
                )
              : _Upload(
                  session: session,
                  state: value,
                  onCamera: _takePhoto,
                  onGallery: _pickGallery,
                  onChange: _changeImage,
                  onRemove: () => ref
                      .read(checkoutProvider(session.packageCode).notifier)
                      .removeImage(),
                  onSubmit: _submit,
                ),
        ),
      ),
    );
  }

  // ── image input ─────────────────────────────────────────────────────────

  Future<void> _takePhoto() async {
    final session = widget.session;
    if (session == null) return;
    final bytes = await context.push<Uint8List>(Routes.cameraCapture);
    if (bytes == null || !mounted) return;
    // The camera hands back bytes; chooseImage reads them immediately (the
    // temp file only backs the preview), so a cache purge cannot lose it.
    final file = File(
      '${Directory.systemTemp.path}/checkout_'
      '${DateTime.now().millisecondsSinceEpoch}.jpg',
    );
    await file.writeAsBytes(bytes, flush: true);
    if (!mounted) return;
    _inputMethod = InputMethod.photo;
    await ref
        .read(checkoutProvider(session.packageCode).notifier)
        .chooseImage(file);
  }

  Future<void> _pickGallery() async {
    final session = widget.session;
    if (session == null) return;
    final picker = ref.read(verifyImagePickerProvider);
    final allowed = await picker.ensureGalleryAccess();
    if (!allowed || !mounted) return;

    File? file;
    try {
      file = await picker.pickFromGallery();
    } catch (_) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: AppLocalizations.of(context).genericError,
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    if (file == null || !mounted) return;
    _inputMethod = InputMethod.upload;
    await ref
        .read(checkoutProvider(session.packageCode).notifier)
        .chooseImage(file);
  }

  Future<void> _changeImage() async {
    final l10n = AppLocalizations.of(context);
    PhotoSourcePicker.show(
      context,
      title: l10n.billingUploadHeading,
      cameraLabel: l10n.takePhoto,
      galleryLabel: l10n.uploadImage,
      onCamera: _takePhoto,
      onGallery: _pickGallery,
    );
  }

  Future<void> _submit() async {
    final session = widget.session;
    if (session == null) return;

    final result = await ref
        .read(checkoutProvider(session.packageCode).notifier)
        .submit(inputMethod: _inputMethod);

    if (!mounted) return;
    switch (result) {
      case Success<BillingSubmitted>(:final data):
        context.pushReplacement(Routes.billingResultFor(data.billingVerificationId));
      case Failure<BillingSubmitted>(:final error):
        AppSnackbar.show(
          context,
          message: error.userFacingMessage(AppLocalizations.of(context)),
          variant: AppSnackbarVariant.error,
        );
    }
  }
}

class _Instructions extends StatelessWidget {
  const _Instructions({required this.session, required this.onPaid});

  final BillingSession session;
  final VoidCallback onPaid;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.xxxl,
      ),
      children: [
        Text(
          l10n.billingPayAmount(
            formatEtbMinor(
              session.expectedAmountValue,
              currency: session.currency,
            ),
          ),
          style: AppTypography.headingMedium.copyWith(
            color: colors.textPrimary,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        PaymentInstructionsCard(
          instructions: session.instructions,
          onCopy: (value) async {
            await Clipboard.setData(ClipboardData(text: value));
            if (!context.mounted) return;
            AppSnackbar.show(
              context,
              message: l10n.billingCopied,
              variant: AppSnackbarVariant.success,
            );
          },
        ),
        const SizedBox(height: AppSpacing.xl),
        Text(
          l10n.billingSteps,
          style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.xxl),
        AppButton(label: l10n.billingIvePaid, onPressed: onPaid),
      ],
    );
  }
}

class _Upload extends StatelessWidget {
  const _Upload({
    required this.session,
    required this.state,
    required this.onCamera,
    required this.onGallery,
    required this.onChange,
    required this.onRemove,
    required this.onSubmit,
  });

  final BillingSession session;
  final CheckoutState state;
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final VoidCallback onChange;
  final VoidCallback onRemove;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final error = state.error;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.xxxl,
      ),
      children: [
        Text(
          l10n.billingUploadHeading,
          style: AppTypography.headingMedium.copyWith(
            color: colors.textPrimary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          l10n.billingUploadBody,
          style: AppTypography.bodySmall.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.xl),
        ReceiptUploadSection(
          imagePath: state.imagePath,
          busy: state.isBusy,
          progress: state.uploadProgress,
          onCamera: onCamera,
          onGallery: onGallery,
          onChange: onChange,
          onRemove: onRemove,
        ),
        if (error != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            error.userFacingMessage(l10n),
            style: AppTypography.bodySmall.copyWith(color: colors.error),
          ),
        ],
        const SizedBox(height: AppSpacing.xxl),
        AppButton(
          label: l10n.billingSubmitForVerification,
          isLoading: state.isBusy,
          onPressed: state.hasImage && !state.isBusy ? onSubmit : null,
        ),
      ],
    );
  }
}
