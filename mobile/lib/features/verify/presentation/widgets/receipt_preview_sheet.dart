// Full-width receipt preview. The image URL is a 300 s presigned GET, so it
// is fetched fresh each time the sheet opens and never cached by the app.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_result.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/feedback/app_bottom_sheet.dart';
import '../../data/models/receipt_download.dart';
import '../../data/verify_repository.dart';

class ReceiptPreviewSheet extends ConsumerStatefulWidget {
  const ReceiptPreviewSheet({super.key, required this.receiptId});

  final String receiptId;

  static Future<void> show(BuildContext context, {required String receiptId}) {
    return AppBottomSheet.show<void>(
      context,
      title: AppLocalizations.of(context).verdictViewReceiptButton,
      maxHeightFraction: 0.92,
      child: ReceiptPreviewSheet(receiptId: receiptId),
    );
  }

  @override
  ConsumerState<ReceiptPreviewSheet> createState() => _ReceiptPreviewSheetState();
}

class _ReceiptPreviewSheetState extends ConsumerState<ReceiptPreviewSheet> {
  late Future<ApiResult<ReceiptDownload>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<ApiResult<ReceiptDownload>> _load() {
    return ref.read(receiptsApiProvider).getById(widget.receiptId);
  }

  void _reload() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ApiResult<ReceiptDownload>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Padding(
            padding: EdgeInsets.all(AppSpacing.giant),
            child: Center(child: CircularProgressIndicator()),
          );
        }

        final data = snapshot.data;
        final url = data is Success<ReceiptDownload> ? data.data.downloadUrl : '';

        if (url.isEmpty) {
          return _Unavailable(onRetry: _reload);
        }

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          child: InteractiveViewer(
            minScale: 1,
            maxScale: 4,
            child: Image.network(
              url,
              fit: BoxFit.contain,
              loadingBuilder: (context, child, progress) {
                if (progress == null) return child;
                return const Padding(
                  padding: EdgeInsets.all(AppSpacing.giant),
                  child: Center(child: CircularProgressIndicator()),
                );
              },
              errorBuilder: (context, error, stack) =>
                  _Unavailable(onRetry: _reload),
            ),
          ),
        );
      },
    );
  }
}

class _Unavailable extends StatelessWidget {
  const _Unavailable({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xxl,
      ),
      child: Column(
        children: [
          Icon(Icons.broken_image_outlined, size: 32, color: colors.textSecondary),
          const SizedBox(height: AppSpacing.md),
          Text(
            l10n.verdictReceiptUnavailable,
            textAlign: TextAlign.center,
            style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: l10n.verdictReceiptRetry,
            variant: AppButtonVariant.secondary,
            onPressed: onRetry,
          ),
        ],
      ),
    );
  }
}
