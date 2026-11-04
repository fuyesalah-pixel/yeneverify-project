import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/localization/locale_provider.dart';
import 'package:yene_verify/core/theme/theme_mode_provider.dart';
import 'package:yene_verify/features/auth/domain/auth_notifier.dart';
import 'package:yene_verify/features/dashboard/data/models/merchant_me.dart';
import 'package:yene_verify/features/dashboard/data/models/subscription_me.dart';
import 'package:yene_verify/features/profile/presentation/providers/profile_providers.dart';
import 'package:yene_verify/features/profile/presentation/screens/profile_screen.dart';

import '../sub_merchants/team_harness.dart';

List<Override> profileOverrides(FakeTeamRepository repo, FakeAuthNotifier auth) => [
      ...teamOverrides(repo: repo, packageCode: 'BUSINESS'),
      authProvider.overrideWith(() => auth),
      merchantMeProvider.overrideWith(
        (ref) async => const MerchantMe(
          id: 'm1',
          businessName: 'Selam Coffee',
          status: 'ACTIVE',
          creditsBalance: '20',
          currentPackageCode: 'BUSINESS',
        ),
      ),
      subscriptionMeProvider.overrideWith(
        (ref) async => const SubscriptionMe(
          packageCode: 'BUSINESS',
          packageName: 'Business',
          unlimited: false,
          creditsBalance: '20',
          lowBalance: false,
          daysRemaining: 22,
        ),
      ),
      appVersionProvider.overrideWith((ref) async => '1.6.2'),
    ];

FakeAuthNotifier signedInAuth() => FakeAuthNotifier(
      AuthState(status: AuthStatus.unlocked, user: testUser()),
    );

void main() {
  testWidgets('renders identity, plan, all sections and the app version',
      (tester) async {
    final repo = FakeTeamRepository(
      page: teamPage([
        member('m1', 'Hanna Tesfaye', branch: 'Bole', phone: '+251*****77'),
        pendingInvite('i1'),
      ]),
    );

    await pumpTeam(
      tester,
      const ProfileScreen(),
      overrides: profileOverrides(repo, signedInAuth()),
    );

    expect(find.text('Fikru Bekele'), findsOneWidget);
    expect(find.text('+251*****11'), findsOneWidget);
    expect(find.text('Business: Selam Coffee'), findsOneWidget);
    expect(find.text('Account'), findsOneWidget);
    expect(find.text('Team'), findsOneWidget);
    expect(find.text('Manage team'), findsOneWidget);
    expect(find.text('1 members · 1 pending'), findsOneWidget);
    expect(find.text('Subscription'), findsOneWidget);
    expect(find.text('Business · renews in 22 days'), findsOneWidget);
    expect(find.text('Preferences'), findsOneWidget);
    expect(find.text('English'), findsOneWidget);
    expect(find.text('አማርኛ'), findsOneWidget);
    expect(find.text('Theme'), findsOneWidget);
    expect(find.text('Support'), findsOneWidget);
    expect(find.text('Help center'), findsOneWidget);
    expect(find.text('Contact support'), findsOneWidget);
    expect(find.text('Sign out'), findsOneWidget);
    expect(find.text('Version 1.6.2'), findsOneWidget);
  });

  testWidgets('the language toggle switches the app locale to Amharic',
      (tester) async {
    final repo = FakeTeamRepository(page: teamPage([]));

    await pumpTeam(
      tester,
      const ProfileScreen(),
      overrides: profileOverrides(repo, signedInAuth()),
    );

    await tester.ensureVisible(find.text('አማርኛ'));
    await tester.tap(find.text('አማርኛ'));
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ProfileScreen)),
    );
    expect(container.read(localeProvider)?.languageCode, 'am');
  });

  testWidgets('the theme toggle stores the selected mode', (tester) async {
    final repo = FakeTeamRepository(page: teamPage([]));

    await pumpTeam(
      tester,
      const ProfileScreen(),
      overrides: profileOverrides(repo, signedInAuth()),
    );

    await tester.ensureVisible(find.text('Dark'));
    await tester.tap(find.text('Dark'));
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ProfileScreen)),
    );
    expect(container.read(themeModeProvider), ThemeMode.dark);
  });

  testWidgets('sign out asks for confirmation and can be cancelled',
      (tester) async {
    final repo = FakeTeamRepository(page: teamPage([]));
    final auth = signedInAuth();

    await pumpTeam(
      tester,
      const ProfileScreen(),
      overrides: profileOverrides(repo, auth),
    );

    await tester.ensureVisible(find.text('Sign out'));
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();

    expect(find.text('Sign out of Yene Verify?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();

    expect(auth.loggedOut, isFalse);
  });

  testWidgets('confirming sign out clears the session', (tester) async {
    final repo = FakeTeamRepository(page: teamPage([]));
    final auth = signedInAuth();

    await pumpTeam(
      tester,
      const ProfileScreen(),
      overrides: profileOverrides(repo, auth),
    );

    await tester.ensureVisible(find.text('Sign out'));
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Sign out').last);
    await tester.pumpAndSettle();

    expect(auth.loggedOut, isTrue);
  });
}
