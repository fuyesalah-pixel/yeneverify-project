// Step 22A onboarding tests: merchant setup validation/submission, success
// handover, invite accept/decline, and step-based dispatch.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/core/theme/app_theme.dart';
import 'package:yene_verify/core/widgets/buttons/app_button.dart';
import 'package:yene_verify/features/auth/data/models/auth_models.dart';
import 'package:yene_verify/features/auth/domain/auth_notifier.dart';
import 'package:yene_verify/features/onboarding/data/models/create_merchant_request.dart';
import 'package:yene_verify/features/onboarding/data/models/create_merchant_response.dart';
import 'package:yene_verify/features/onboarding/data/onboarding_repository.dart';
import 'package:yene_verify/features/onboarding/presentation/screens/invite_accept_screen.dart';
import 'package:yene_verify/features/onboarding/presentation/screens/merchant_setup_screen.dart';
import 'package:yene_verify/features/onboarding/presentation/screens/merchant_setup_success_screen.dart';
import 'package:yene_verify/features/onboarding/presentation/screens/onboarding_flow_screen.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

const _merchantState = AuthState(
  status: AuthStatus.unlocked,
  needsOnboarding: true,
  onboardingStep: 'MERCHANT_PROFILE',
);

class _FakeAuthNotifier extends AuthNotifier {
  _FakeAuthNotifier(this.current);

  AuthState current;

  @override
  Future<AuthState> build() async => current;

  @override
  Future<ApiError?> refreshOnboardingStatus() async => null;

  @override
  void setBusinessName(String name) {
    current = current.copyWith(businessName: name);
    state = AsyncData(current);
  }

  void emit(AuthState next) {
    current = next;
    state = AsyncData(next);
  }
}

class _FakeOnboardingRepository implements OnboardingRepository {
  _FakeOnboardingRepository({this.createResult, this.onDecline});

  final ApiResult<CreateMerchantResponse>? createResult;
  final void Function()? onDecline;

  int createCalls = 0;
  CreateMerchantRequest? lastRequest;
  String? acceptedToken;
  String? declinedToken;

  @override
  Future<ApiResult<CreateMerchantResponse>> createMerchant(
    CreateMerchantRequest request,
  ) async {
    createCalls++;
    lastRequest = request;
    return createResult ??
        const Success(
          CreateMerchantResponse(
            merchantId: 'm-1',
            businessName: 'Test Coffee Shop',
            status: 'ACTIVE',
            currentPackageCode: 'FREE',
            creditsBalance: '10',
          ),
        );
  }

  @override
  Future<ApiResult<AcceptInviteResponse>> acceptInvite(String token) async {
    acceptedToken = token;
    return const Success(
      AcceptInviteResponse(subMerchantId: 'sub-1', merchantId: 'm-1'),
    );
  }

  @override
  Future<ApiResult<bool>> declineInvite(String token) async {
    declinedToken = token;
    onDecline?.call();
    return const Success(true);
  }
}

Widget _routedApp({
  required List<Override> overrides,
  required Widget onboardingBuilder,
}) {
  final router = GoRouter(
    initialLocation: '/onboarding',
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (_, __) => onboardingBuilder,
      ),
      GoRoute(
        path: '/onboarding/success',
        builder: (_, state) => MerchantSetupSuccessScreen(
          businessName: (state.extra as String?) ?? '',
        ),
      ),
      GoRoute(
        path: '/dashboard',
        builder: (_, __) =>
            const Scaffold(body: Center(child: Text('Dashboard stub'))),
      ),
    ],
  );

  return ProviderScope(
    overrides: overrides,
    child: MaterialApp.router(
      routerConfig: router,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      theme: AppTheme.lightTheme(),
    ),
  );
}

AppButton _button(WidgetTester tester, String label) =>
    tester.widget<AppButton>(find.widgetWithText(AppButton, label));

void main() {
  test('CreateMerchantResponse parses the nested backend shape', () {
    final response = CreateMerchantResponse.fromJson({
      'merchant': {
        'id': 'm-1',
        'businessName': "Selam's Coffee",
        'status': 'ACTIVE',
        'currentPackageCode': 'FREE',
        'creditsBalance': '10',
        'createdAt': '2026-11-02T10:00:00.000Z',
      },
      'subscription': {'id': 'sub-1', 'status': 'ACTIVE'},
    });

    expect(response.merchantId, 'm-1');
    expect(response.businessName, "Selam's Coffee");
    expect(response.creditsBalance, '10');
    expect(response.currentPackageCode, 'FREE');
  });

  group('MerchantSetupScreen', () {
    testWidgets('create is disabled until the business name is valid',
        (tester) async {
      final repo = _FakeOnboardingRepository();
      await tester.pumpWidget(_routedApp(
        overrides: [
          authProvider.overrideWith(() => _FakeAuthNotifier(_merchantState)),
          onboardingRepositoryProvider.overrideWithValue(repo),
        ],
        onboardingBuilder: const MerchantSetupScreen(),
      ));
      await tester.pump();

      expect(find.text("Let's set up your business"), findsOneWidget);
      expect(_button(tester, 'Create business').onPressed, isNull);

      await tester.enterText(find.byType(TextField), 'A');
      await tester.pump();
      expect(_button(tester, 'Create business').onPressed, isNull);

      await tester.enterText(find.byType(TextField), 'Test Coffee Shop');
      await tester.pump();
      expect(_button(tester, 'Create business').onPressed, isNotNull);
    });

    testWidgets('creates the merchant, celebrates, then lands on dashboard',
        (tester) async {
      final repo = _FakeOnboardingRepository();
      final auth = _FakeAuthNotifier(_merchantState);

      await tester.pumpWidget(_routedApp(
        overrides: [
          authProvider.overrideWith(() => auth),
          onboardingRepositoryProvider.overrideWithValue(repo),
        ],
        onboardingBuilder: const MerchantSetupScreen(),
      ));
      await tester.pump();

      await tester.enterText(find.byType(TextField), '  Test Coffee Shop  ');
      await tester.pump();
      await tester.tap(find.widgetWithText(AppButton, 'Create business'));
      await tester.pump();
      await tester.pump();

      expect(repo.createCalls, 1);
      expect(repo.lastRequest?.businessName, 'Test Coffee Shop');
      expect(auth.current.businessName, 'Test Coffee Shop');
      expect(find.byType(MerchantSetupSuccessScreen), findsOneWidget);
      expect(find.text("You're all set"), findsOneWidget);
      expect(
        find.text('Your business Test Coffee Shop is now on Yene Verify.'),
        findsOneWidget,
      );

      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
      expect(find.text('Dashboard stub'), findsOneWidget);
    });

    testWidgets('MERCHANT_ALREADY_ONBOARDED redirects to the dashboard',
        (tester) async {
      final repo = _FakeOnboardingRepository(
        createResult: const Failure(
          ApiError(
            code: 'MERCHANT_ALREADY_ONBOARDED',
            httpStatus: 409,
          ),
        ),
      );

      await tester.pumpWidget(_routedApp(
        overrides: [
          authProvider.overrideWith(() => _FakeAuthNotifier(_merchantState)),
          onboardingRepositoryProvider.overrideWithValue(repo),
        ],
        onboardingBuilder: const MerchantSetupScreen(),
      ));
      await tester.pump();

      await tester.enterText(find.byType(TextField), 'Test Coffee Shop');
      await tester.pump();
      await tester.tap(find.widgetWithText(AppButton, 'Create business'));
      await tester.pumpAndSettle();

      expect(find.text('Dashboard stub'), findsOneWidget);
    });
  });

  group('OnboardingFlowScreen step dispatch', () {
    testWidgets('MERCHANT_PROFILE shows the merchant form', (tester) async {
      await tester.pumpWidget(_routedApp(
        overrides: [
          authProvider.overrideWith(() => _FakeAuthNotifier(_merchantState)),
          onboardingRepositoryProvider
              .overrideWithValue(_FakeOnboardingRepository()),
        ],
        onboardingBuilder: const OnboardingFlowScreen(),
      ));
      await tester.pump();

      expect(find.byType(MerchantSetupScreen), findsOneWidget);
    });

    testWidgets('SUB_MERCHANT_ACCEPT shows the invite screen', (tester) async {
      const inviteState = AuthState(
        status: AuthStatus.unlocked,
        needsOnboarding: true,
        onboardingStep: 'SUB_MERCHANT_ACCEPT',
        pendingInvite: PendingInvite(
          id: 'inv-1',
          merchantName: 'Kebede Trading',
          branchLabel: 'Bole',
        ),
      );

      await tester.pumpWidget(_routedApp(
        overrides: [
          authProvider.overrideWith(() => _FakeAuthNotifier(inviteState)),
          onboardingRepositoryProvider
              .overrideWithValue(_FakeOnboardingRepository()),
        ],
        onboardingBuilder: const OnboardingFlowScreen(),
      ));
      await tester.pump();

      expect(find.byType(InviteAcceptScreen), findsOneWidget);
      expect(
        find.text('Kebede Trading invited you to join their team'),
        findsOneWidget,
      );
      expect(find.text('Branch: Bole'), findsOneWidget);
    });
  });

  group('InviteAcceptScreen', () {
    const inviteState = AuthState(
      status: AuthStatus.unlocked,
      needsOnboarding: true,
      onboardingStep: 'SUB_MERCHANT_ACCEPT',
      pendingInvite: PendingInvite(
        id: 'inv-1',
        merchantName: 'Kebede Trading',
      ),
    );

    testWidgets('accept is disabled until a token is entered', (tester) async {
      await tester.pumpWidget(_routedApp(
        overrides: [
          authProvider.overrideWith(() => _FakeAuthNotifier(inviteState)),
          onboardingRepositoryProvider
              .overrideWithValue(_FakeOnboardingRepository()),
        ],
        onboardingBuilder: const InviteAcceptScreen(),
      ));
      await tester.pump();

      expect(_button(tester, 'Accept invite').onPressed, isNull);

      await tester.enterText(find.byType(TextField), 'eyJhbGciOiJIUzI1NiJ9');
      await tester.pump();
      expect(_button(tester, 'Accept invite').onPressed, isNotNull);
    });

    testWidgets('accept posts the token and lands on the dashboard',
        (tester) async {
      final repo = _FakeOnboardingRepository();
      await tester.pumpWidget(_routedApp(
        overrides: [
          authProvider.overrideWith(() => _FakeAuthNotifier(inviteState)),
          onboardingRepositoryProvider.overrideWithValue(repo),
        ],
        onboardingBuilder: const InviteAcceptScreen(),
      ));
      await tester.pump();

      await tester.enterText(find.byType(TextField), 'invite-token-123');
      await tester.pump();
      await tester.tap(find.widgetWithText(AppButton, 'Accept invite'));
      await tester.pumpAndSettle();

      expect(repo.acceptedToken, 'invite-token-123');
      expect(find.text('Dashboard stub'), findsOneWidget);
    });

    testWidgets('decline confirms, posts, and swaps to the merchant form',
        (tester) async {
      final auth = _FakeAuthNotifier(inviteState);
      final repo = _FakeOnboardingRepository(
        onDecline: () => auth.emit(const AuthState(
          status: AuthStatus.unlocked,
          needsOnboarding: true,
          onboardingStep: 'MERCHANT_PROFILE',
        )),
      );

      await tester.pumpWidget(_routedApp(
        overrides: [
          authProvider.overrideWith(() => auth),
          onboardingRepositoryProvider.overrideWithValue(repo),
        ],
        onboardingBuilder: const OnboardingFlowScreen(),
      ));
      await tester.pump();

      await tester.enterText(find.byType(TextField), 'invite-token-123');
      await tester.pump();
      await tester.tap(find.widgetWithText(AppButton, 'Decline'));
      await tester.pumpAndSettle();

      expect(find.text('Decline this invite?'), findsOneWidget);

      await tester.tap(find.text('Decline').last);
      await tester.pumpAndSettle();

      expect(repo.declinedToken, 'invite-token-123');
      expect(find.byType(MerchantSetupScreen), findsOneWidget);
    });
  });
}
