// Debug-only OCR banner for the verify screen.
//
// The 0/7 receipt report happened because the app silently verified against an
// empty OCR mock. This banner makes that state impossible to miss on a debug
// build: it names the provider and the fixture count, and tapping it opens the
// full diagnostics (provider, fixtures, backend URL and health, bank-endpoint
// reachability).
//
// Never rendered in release builds (kDebugMode only). Host-side widget tests
// are excluded too: there is no device backend to probe, and a real HTTP call
// under fake_async would leave pending timers.
import 'dart:io';

import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/env/app_env.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/ocr_diagnostics.dart';

class OcrDebugBanner extends ConsumerWidget {
  const OcrDebugBanner({super.key, this.visible});

  /// Test seam only: null follows the real rule (kDebugMode on a device).
  final bool? visible;

  bool get _visible =>
      visible ?? (kDebugMode && (Platform.isAndroid || Platform.isIOS));

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!_visible) return const SizedBox.shrink();

    final colors = context.colors;
    final async = ref.watch(ocrDiagnosticsProvider);
    final data = async.valueOrNull;

    final label = async.isLoading
        ? 'Dev: OCR — checking…'
        : data?.bannerLabel ?? 'Dev: OCR diagnostics unavailable';
    final alarming = data != null && data.isMock && data.fixtures == 0;

    return Material(
      color: colors.surfaceAlt,
      child: InkWell(
        onTap: () => _openSheet(context, data),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: colors.border)),
          ),
          child: Row(
            children: [
              Icon(
                alarming ? Icons.error_outline : Icons.science_outlined,
                size: 14,
                color: alarming ? colors.error : colors.warning,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodySmall.copyWith(
                    color: alarming ? colors.error : colors.textSecondary,
                  ),
                ),
              ),
              Icon(Icons.chevron_right, size: 14, color: colors.textDisabled),
            ],
          ),
        ),
      ),
    );
  }

  void _openSheet(BuildContext context, OcrDiagnostics? data) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => _DiagnosticsSheet(data: data),
    );
  }
}

class _DiagnosticsSheet extends ConsumerWidget {
  const _DiagnosticsSheet({required this.data});

  final OcrDiagnostics? data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final diagnostics = data;

    if (diagnostics == null) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'OCR diagnostics unavailable',
                style: AppTypography.headingSmall,
              ),
              const SizedBox(height: 8),
              Text(
                'The backend did not answer GET /health/ocr. Check that the dev '
                'server is running and reachable from this device.',
                style: AppTypography.bodySmall.copyWith(
                  color: colors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              const _Row(label: 'Backend', value: AppEnv.healthBaseUrl),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => ref.invalidate(ocrDiagnosticsProvider),
                child: const Text('Refresh status'),
              ),
            ],
          ),
        ),
      );
    }

    final ready = diagnostics.ready;
    final backendHealth = ready == null
        ? 'unreachable'
        : '${ready.status} · ocr ${ready.ocrStatus ?? 'unknown'}';

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('OCR diagnostics', style: AppTypography.headingSmall),
            const SizedBox(height: 12),
            _Row(label: 'Provider', value: diagnostics.provider),
            _Row(label: 'Fixtures loaded', value: '${diagnostics.fixtures}'),
            const _Row(label: 'Backend', value: AppEnv.healthBaseUrl),
            _Row(label: 'Backend health', value: backendHealth),
            if (ready?.ocrMessage != null) ...[
              const SizedBox(height: 4),
              Text(
                ready!.ocrMessage!,
                style: AppTypography.bodySmall.copyWith(
                  color: ready.ocrStatus == 'up'
                      ? colors.textSecondary
                      : colors.error,
                ),
              ),
            ],
            if (diagnostics.bankAdapterMock) ...[
              const _Row(label: 'Bank adapters', value: 'mock'),
            ],
            const SizedBox(height: 20),
            Text(
              'Bank endpoints',
              style: AppTypography.bodySmall.copyWith(
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: 6),
            if (diagnostics.banks.isEmpty)
              const Text(
                'No adapters registered',
                style: AppTypography.bodySmall,
              ),
            for (final bank in diagnostics.banks) _BankRow(bank: bank),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => ref.invalidate(ocrDiagnosticsProvider),
              child: const Text('Refresh status'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 116,
            child: Text(
              label,
              style: AppTypography.bodySmall.copyWith(
                color: colors.textSecondary,
              ),
            ),
          ),
          Expanded(child: Text(value, style: AppTypography.bodySmall)),
        ],
      ),
    );
  }
}

class _BankRow extends StatelessWidget {
  const _BankRow({required this.bank});

  final BankProbe bank;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final reachable = bank.reachable;
    final dotColor = reachable == null
        ? colors.textDisabled
        : reachable
            ? colors.success
            : colors.error;

    final detail = reachable == null
        ? 'not probed'
        : reachable
            ? 'reachable${bank.status != null ? ' · HTTP ${bank.status}' : ''}'
            : 'unreachable${bank.error != null ? ' · ${bank.error}' : ''}';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 78,
            child: Text(bank.bankCode, style: AppTypography.bodySmall),
          ),
          Expanded(
            child: Text(
              '${bank.host} · $detail',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.bodySmall.copyWith(
                color: colors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
