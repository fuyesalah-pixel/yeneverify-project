// Merchant creation — the onboarding gate for a MERCHANT with no profile.
// Step 22A. No back button and no skip: this is required.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/feedback/app_snackbar.dart';
import '../../../../core/widgets/inputs/app_text_field.dart';
import '../../domain/business_types.dart';
import '../providers/merchant_setup_provider.dart';
import '../widgets/business_type_picker.dart';

class MerchantSetupScreen extends ConsumerWidget {
  const MerchantSetupScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final state = ref.watch(merchantSetupProvider).valueOrNull ??
        const MerchantSetupState();

    return Scaffold(
      appBar: AppBar(automaticallyImplyLeading: false),
      backgroundColor: colors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.xxxl,
            AppSpacing.lg,
            AppSpacing.xxl,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.onboardingMerchantTitle,
                style: AppTypography.displayMedium,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                l10n.onboardingMerchantSubtitle,
                style: AppTypography.bodyMedium.copyWith(
                  color: colors.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.giant),
              AppTextField(
                label: l10n.businessName,
                hint: l10n.businessNameHint,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                errorText: _businessNameError(l10n, state.businessNameError),
                onChanged: ref.read(merchantSetupProvider.notifier).setBusinessName,
              ),
              const SizedBox(height: AppSpacing.xxl),
              _DetailsExpander(
                expanded: state.showDetails,
                onToggle: ref.read(merchantSetupProvider.notifier).toggleDetails,
              ),
              if (state.showDetails) ...[
                const SizedBox(height: AppSpacing.xl),
                Text(l10n.businessType, style: AppTypography.labelMedium),
                const SizedBox(height: AppSpacing.sm),
                BusinessTypePicker(
                  selected: state.businessType,
                  onSelected:
                      ref.read(merchantSetupProvider.notifier).setBusinessType,
                ),
                const SizedBox(height: AppSpacing.lg),
                AppTextField(
                  label: l10n.tinLabel,
                  textCapitalization: TextCapitalization.characters,
                  onChanged: ref.read(merchantSetupProvider.notifier).setTin,
                ),
                const SizedBox(height: AppSpacing.lg),
                AppTextField(
                  label: l10n.addressLabel,
                  textCapitalization: TextCapitalization.sentences,
                  onChanged: ref.read(merchantSetupProvider.notifier).setAddress,
                ),
                const SizedBox(height: AppSpacing.lg),
                AppTextField(
                  label: l10n.cityLabel,
                  initialValue: state.city,
                  textCapitalization: TextCapitalization.words,
                  onChanged: ref.read(merchantSetupProvider.notifier).setCity,
                ),
              ],
              const SizedBox(height: AppSpacing.xxxl),
              AppButton(
                label: l10n.createBusiness,
                isLoading: state.isSubmitting,
                onPressed: state.isBusinessNameValid && !state.isSubmitting
                    ? () => _submit(context, ref)
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }

  String? _businessNameError(
    AppLocalizations l10n,
    BusinessNameError? error,
  ) {
    return switch (error) {
      null => null,
      BusinessNameError.required => l10n.businessNameRequired,
      BusinessNameError.tooShort => l10n.businessNameTooShort,
      BusinessNameError.tooLong => l10n.businessNameTooLong,
    };
  }

  Future<void> _submit(BuildContext context, WidgetRef ref) async {
    final outcome = await ref.read(merchantSetupProvider.notifier).submit();
    if (!context.mounted) return;

    final l10n = AppLocalizations.of(context);
    final state = ref.read(merchantSetupProvider).valueOrNull;

    switch (outcome) {
      case MerchantSubmitOutcome.success:
        final name = state?.merchant?.businessName ?? state?.businessName ?? '';
        context.go(Routes.onboardingSuccess, extra: name);

      case MerchantSubmitOutcome.alreadyOnboarded:
        context.go(Routes.dashboard);

      case MerchantSubmitOutcome.failed:
        final error = state?.error;
        if (error == null) return; // inline business-name error
        if (error.isNetwork || error.isTimeout) {
          AppSnackbar.show(
            context,
            message: l10n.networkError,
            variant: AppSnackbarVariant.error,
          );
          return;
        }
        AppSnackbar.show(
          context,
          message: _errorMessage(l10n, error),
          variant: AppSnackbarVariant.error,
        );
    }
  }

  String _errorMessage(AppLocalizations l10n, ApiError error) {
    if (error.code == 'VALIDATION_FAILED' && error.message != null) {
      return error.message!;
    }
    return error.userFacingMessage(l10n);
  }
}

class _DetailsExpander extends StatelessWidget {
  const _DetailsExpander({required this.expanded, required this.onToggle});

  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        onPressed: onToggle,
        icon: Icon(
          expanded ? Icons.expand_less : Icons.expand_more,
          size: 20,
          color: colors.primaryAction,
        ),
        label: Text(
          l10n.addMoreDetails,
          style: AppTypography.labelMedium.copyWith(
            color: colors.primaryAction,
          ),
        ),
      ),
    );
  }
}
