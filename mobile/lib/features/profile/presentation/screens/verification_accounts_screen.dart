// Verification accounts — the bank identifiers adapters cannot read from
// a receipt. The merchant enters each full account number; the backend
// derives the suffix (CBE last 8, Abyssinia last 5, Awash account number).
//
// Saving is step-up protected: the user re-enters their PIN, the PIN is
// exchanged for a step-up token, and the PUT carries X-Step-Up-Token.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/network/api_result.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/feedback/app_snackbar.dart';
import '../../../../core/widgets/feedback/pin_prompt.dart';
import '../../../../core/widgets/inputs/app_text_field.dart';
import '../../../../core/widgets/layout/app_error_state.dart';
import '../../../auth/data/auth_repository.dart';
import '../../../auth/data/models/auth_models.dart';
import '../../data/models/verification_accounts.dart';
import '../../data/verification_accounts_api.dart';
import '../providers/verification_accounts_provider.dart';

class VerificationAccountsScreen extends ConsumerWidget {
  const VerificationAccountsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final accounts = ref.watch(verificationAccountsProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.verificationAccountsTitle)),
      body: accounts.when(
        loading: () => Center(
          child: CircularProgressIndicator(color: colors.primaryAction),
        ),
        error: (error, _) => Center(
          child: Padding(
            padding: AppSpacing.screenH,
            child: AppErrorState(
              message: error is ApiError
                  ? error.userFacingMessage(l10n)
                  : l10n.genericError,
              compact: true,
              onRetry: () => ref.invalidate(verificationAccountsProvider),
              retryLabel: l10n.retryLabel,
            ),
          ),
        ),
        data: (accounts) => _AccountsForm(
          key: ValueKey(
            '${accounts.cbeFull}|${accounts.abyssiniaFull}|${accounts.awashFull}',
          ),
          initial: accounts,
        ),
      ),
    );
  }
}

class _AccountsForm extends ConsumerStatefulWidget {
  const _AccountsForm({super.key, required this.initial});

  final VerificationAccounts initial;

  @override
  ConsumerState<_AccountsForm> createState() => _AccountsFormState();
}

class _AccountsFormState extends ConsumerState<_AccountsForm> {
  late final TextEditingController _cbe;
  late final TextEditingController _abyssinia;
  late final TextEditingController _awash;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _cbe = TextEditingController(text: widget.initial.cbeFull ?? '');
    _abyssinia =
        TextEditingController(text: widget.initial.abyssiniaFull ?? '');
    _awash = TextEditingController(text: widget.initial.awashFull ?? '');
  }

  @override
  void dispose() {
    _cbe.dispose();
    _abyssinia.dispose();
    _awash.dispose();
    super.dispose();
  }

  static bool _isFullAccount(String value) =>
      value.isEmpty || (value.length >= 10 && value.length <= 16);

  bool get _cbeValid => _isFullAccount(_cbe.text);
  bool get _abyssiniaValid => _isFullAccount(_abyssinia.text);
  bool get _awashValid => _isFullAccount(_awash.text);

  bool get _formValid => _cbeValid && _abyssiniaValid && _awashValid;

  VerificationAccounts get _values => VerificationAccounts(
        cbeFull: _cbe.text.isEmpty ? null : _cbe.text,
        abyssiniaFull: _abyssinia.text.isEmpty ? null : _abyssinia.text,
        awashFull: _awash.text.isEmpty ? null : _awash.text,
      );

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    if (!_formValid || _saving) return;

    final pin = await PinPrompt.show(
      context,
      title: l10n.verificationAccountsStepUpTitle,
      body: l10n.verificationAccountsStepUpBody,
      cancelLabel: l10n.cancelLabel,
    );
    if (pin == null || !mounted) return;

    setState(() => _saving = true);
    try {
      final stepUp = await ref.read(authRepositoryProvider).verifyPin(pin: pin);
      if (!mounted) return;
      if (stepUp is Failure<StepUpResponse>) {
        AppSnackbar.show(
          context,
          message: stepUp.error.userFacingMessage(l10n),
          variant: AppSnackbarVariant.error,
        );
        return;
      }
      final token = (stepUp as Success<StepUpResponse>).data.stepUpToken;

      final result = await ref
          .read(verificationAccountsApiProvider)
          .update(accounts: _values, stepUpToken: token);
      if (!mounted) return;

      switch (result) {
        case Success<VerificationAccounts>():
          ref.invalidate(verificationAccountsProvider);
          AppSnackbar.show(
            context,
            message: l10n.verificationAccountsSaved,
            variant: AppSnackbarVariant.success,
          );
        case Failure<VerificationAccounts>(:final error):
          AppSnackbar.show(
            context,
            message: error.userFacingMessage(l10n),
            variant: AppSnackbarVariant.error,
          );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

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
          l10n.verificationAccountsIntro,
          style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.xl),
        AppTextField(
          label: l10n.verificationAccountsCbeLabel,
          hint: l10n.verificationAccountsAccountHint,
          helper: l10n.verificationAccountsCbeHelper,
          controller: _cbe,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          maxLength: 16,
          errorText:
              _cbeValid ? null : l10n.verificationAccountsInvalidLength,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: AppSpacing.lg),
        AppTextField(
          label: l10n.verificationAccountsAbyssiniaLabel,
          hint: l10n.verificationAccountsAccountHint,
          helper: l10n.verificationAccountsAbyssiniaHelper,
          controller: _abyssinia,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          maxLength: 16,
          errorText:
              _abyssiniaValid ? null : l10n.verificationAccountsInvalidLength,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: AppSpacing.lg),
        AppTextField(
          label: l10n.verificationAccountsAwashLabel,
          hint: l10n.verificationAccountsAccountHint,
          helper: l10n.verificationAccountsAwashHelper,
          controller: _awash,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          maxLength: 16,
          errorText:
              _awashValid ? null : l10n.verificationAccountsInvalidLength,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: AppSpacing.xxl),
        AppButton(
          label: l10n.saveLabel,
          isLoading: _saving,
          onPressed: _formValid && !_saving ? _save : null,
        ),
      ],
    );
  }
}
