// Step 24 — invite a team member by phone.
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
import '../../../../core/widgets/feedback/app_bottom_sheet.dart';
import '../../../../core/widgets/feedback/app_dialog.dart';
import '../../../../core/widgets/feedback/app_snackbar.dart';
import '../../../../core/widgets/inputs/app_text_field.dart';
import '../../data/models/invite_request.dart';
import '../../data/models/invite_response.dart';
import '../../domain/plan_limits.dart';
import '../providers/sub_merchants_provider.dart';

class InviteSubMerchantScreen extends ConsumerStatefulWidget {
  const InviteSubMerchantScreen({super.key});

  @override
  ConsumerState<InviteSubMerchantScreen> createState() =>
      _InviteSubMerchantScreenState();
}

class _InviteSubMerchantScreenState
    extends ConsumerState<InviteSubMerchantScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _name = TextEditingController();
  final _branch = TextEditingController();
  bool _submitting = false;
  String? _phoneError;

  @override
  void initState() {
    super.initState();
    _phone.addListener(_onPhoneChanged);
  }

  @override
  void dispose() {
    _phone
      ..removeListener(_onPhoneChanged)
      ..dispose();
    _name.dispose();
    _branch.dispose();
    super.dispose();
  }

  void _onPhoneChanged() {
    if (_phoneError != null) setState(() => _phoneError = null);
    setState(() {});
  }

  bool get _canSubmit =>
      !_submitting && normalizeEthiopianPhone(_phone.text) != null;

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final phone = normalizeEthiopianPhone(_phone.text);
    if (phone == null) {
      setState(() => _phoneError = l10n.teamPhoneInvalid);
      return;
    }

    setState(() => _submitting = true);
    final result = await ref.read(subMerchantsProvider.notifier).invite(
          InviteRequest(
            phone: phone,
            name: _name.text,
            branchLabel: _branch.text,
          ),
        );
    if (!mounted) return;
    setState(() => _submitting = false);

    switch (result) {
      case Success<InviteResponse>(:final data):
        await _showSuccess(data, phone);
      case Failure<InviteResponse>(:final error):
        await _showError(error);
    }
  }

  Future<void> _showSuccess(InviteResponse response, String phone) async {
    final l10n = AppLocalizations.of(context);
    final masked = maskEthiopianPhone(phone);

    await AppBottomSheet.show<void>(
      context,
      title: l10n.teamInviteSuccessTitle,
      child: Padding(
        padding: AppSpacing.screenH,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: AppSpacing.sm),
            Icon(
              Icons.mark_email_read_outlined,
              size: 40,
              color: context.colors.success,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              l10n.teamInviteSent(masked),
              textAlign: TextAlign.center,
              style: AppTypography.bodyMedium.copyWith(
                color: context.colors.textPrimary,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.teamInviteAcceptHint,
              textAlign: TextAlign.center,
              style: AppTypography.bodySmall.copyWith(
                color: context.colors.textSecondary,
              ),
            ),
            if (response.inviteUrl != null) ...[
              const SizedBox(height: AppSpacing.md),
              TextButton.icon(
                onPressed: () async {
                  await Clipboard.setData(
                    ClipboardData(text: response.inviteUrl!),
                  );
                  if (!mounted) return;
                  AppSnackbar.show(
                    context,
                    message: l10n.copied,
                    variant: AppSnackbarVariant.success,
                  );
                },
                icon: const Icon(Icons.link_rounded, size: 18),
                label: Text(l10n.teamShareInviteLink),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: l10n.teamDone,
              onPressed: () {
                Navigator.of(context).pop();
                if (Navigator.of(context).canPop()) Navigator.of(context).pop();
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showError(ApiError error) async {
    final l10n = AppLocalizations.of(context);
    switch (error.code) {
      case 'PLAN_LIMIT_SUB_MERCHANTS':
        await AppDialog.alert(
          context,
          title: l10n.teamCapGeneric,
          body: l10n.teamUpgradeBody,
          dismissLabel: l10n.teamDone,
          icon: Icons.workspace_premium_outlined,
        );
      case 'SUB_MERCHANT_ALREADY_EXISTS':
        AppSnackbar.show(
          context,
          message: l10n.teamAlreadyMember,
          variant: AppSnackbarVariant.warning,
        );
      case 'VALIDATION_FAILED':
        setState(() => _phoneError = l10n.teamPhoneInvalid);
      default:
        AppSnackbar.show(
          context,
          message: error.userFacingMessage(l10n),
          variant: AppSnackbarVariant.error,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final cap = ref.watch(subMerchantsProvider).valueOrNull?.cap;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.teamInviteTitle)),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: AppSpacing.screen,
          children: [
            Text(
              l10n.teamInviteHeading,
              style: AppTypography.headingSmall.copyWith(
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              l10n.teamInviteSubtitle,
              style: AppTypography.bodyMedium.copyWith(
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            AppTextField(
              label: l10n.teamPhoneLabel,
              hint: l10n.teamPhoneHint,
              controller: _phone,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
              errorText: _phoneError,
              validator: (value) =>
                  normalizeEthiopianPhone(value ?? '') == null
                      ? l10n.teamPhoneInvalid
                      : null,
            ),
            const SizedBox(height: AppSpacing.lg),
            AppTextField(
              label: l10n.teamNameLabel,
              controller: _name,
              keyboardType: TextInputType.name,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              maxLength: 100,
            ),
            const SizedBox(height: AppSpacing.lg),
            AppTextField(
              label: l10n.teamBranchLabel,
              hint: l10n.teamBranchHint,
              controller: _branch,
              textCapitalization: TextCapitalization.words,
              maxLength: 50,
            ),
            if (cap != null && cap.capped) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                l10n.teamSeatsRemaining(cap.remaining, cap.limit ?? 0),
                style: AppTypography.bodySmall.copyWith(
                  color: colors.textSecondary,
                ),
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.sm,
            AppSpacing.lg,
            AppSpacing.md,
          ),
          child: AppButton(
            label: l10n.teamSendInvite,
            isLoading: _submitting,
            onPressed: _canSubmit ? _submit : null,
          ),
        ),
      ),
    );
  }
}
