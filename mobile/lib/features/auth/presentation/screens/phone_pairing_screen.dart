// Phone pairing screen — shown after Google Sign-In when the Google account
// is not yet linked to a Yene Verify user. Collects phone + fullName, then
// calls POST /auth/google/onboard to create the user and pair the phone.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/inputs/app_text_field.dart';
import '../../../auth/domain/google_auth_provider.dart';

class PhonePairingScreen extends ConsumerStatefulWidget {
  const PhonePairingScreen({super.key});

  @override
  ConsumerState<PhonePairingScreen> createState() => _PhonePairingScreenState();
}

class _PhonePairingScreenState extends ConsumerState<PhonePairingScreen> {
  final _phoneController = TextEditingController();
  final _nameController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _phoneController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);
    final googleAuth = ref.watch(googleAuthProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(l10n.googlePairPhoneTitle),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  l10n.googlePairPhoneSubtitle,
                  style: AppTypography.headingMedium.copyWith(
                    color: colors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  l10n.googlePairPhoneBody,
                  style: AppTypography.bodyMedium.copyWith(
                    color: colors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.xxl),
                AppTextField(
                  label: l10n.fullName,
                  hint: l10n.fullNameHint,
                  controller: _nameController,
                  textCapitalization: TextCapitalization.words,
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return l10n.requiredField;
                    }
                    return null;
                  },
                ),
                const SizedBox(height: AppSpacing.lg),
                AppTextField(
                  label: l10n.phoneNumber,
                  hint: l10n.phoneHint,
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  errorText: googleAuth.error != null
                      ? googleAuth.error!.userFacingMessage(l10n)
                      : null,
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return l10n.requiredField;
                    }
                    final normalized = v.replaceAll(RegExp(r'[\s\-()]'), '');
                    if (!RegExp(r'^(\+251|251|09|9)[0-9]{8,9}$')
                        .hasMatch(normalized)) {
                      return l10n.phoneInvalid;
                    }
                    return null;
                  },
                ),
                const SizedBox(height: AppSpacing.lg),
                if (googleAuth.error != null)
                  Text(
                    googleAuth.error!.userFacingMessage(l10n),
                    style: AppTypography.bodySmall.copyWith(color: colors.error),
                    textAlign: TextAlign.center,
                  ),
                const SizedBox(height: AppSpacing.xl),
                AppButton(
                  label: l10n.googlePairPhoneButton,
                  onPressed: googleAuth.status == GoogleAuthStatus.signingIn
                      ? null
                      : () async {
                          if (!_formKey.currentState!.validate()) return;
                          final phone = _phoneController.text.trim();
                          final name = _nameController.text.trim();
                          final ok = await ref
                              .read(googleAuthProvider.notifier)
                              .pairPhone(phone: phone, fullName: name);
                          if (ok && context.mounted) {
                            Navigator.of(context).pop(true);
                          }
                        },
                  isLoading: googleAuth.status == GoogleAuthStatus.signingIn,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
