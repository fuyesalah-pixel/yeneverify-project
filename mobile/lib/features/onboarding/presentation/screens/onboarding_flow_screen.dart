// Dispatches /onboarding to the step-appropriate screen.
//
// Auth answers "is the session usable?"; onboarding status answers "what does
// this merchant still need?". The router keeps the user on /onboarding while
// needsOnboarding is true.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../auth/domain/auth_notifier.dart';
import 'invite_accept_screen.dart';
import 'merchant_setup_screen.dart';

class OnboardingFlowScreen extends ConsumerWidget {
  const OnboardingFlowScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider).valueOrNull;

    // The router redirects away as soon as onboarding completes; render an
    // empty shell for the frame in between.
    if (auth == null || !auth.needsOnboarding) {
      return const Scaffold(body: SizedBox.shrink());
    }

    if (auth.onboardingStep == 'SUB_MERCHANT_ACCEPT' &&
        auth.pendingInvite != null) {
      return const InviteAcceptScreen();
    }

    return const MerchantSetupScreen();
  }
}
