// Part 0: bank identifiers the adapters cannot read from a receipt.
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/core/network/token_store.dart';
import 'package:yene_verify/core/storage/secure_storage.dart';
import 'package:yene_verify/core/storage/session_store.dart';
import 'package:yene_verify/core/widgets/buttons/app_button.dart';
import 'package:yene_verify/features/auth/data/auth_api.dart';
import 'package:yene_verify/features/auth/data/auth_repository.dart';
import 'package:yene_verify/features/auth/data/models/auth_models.dart';
import 'package:yene_verify/features/profile/data/models/verification_accounts.dart';
import 'package:yene_verify/features/profile/data/verification_accounts_api.dart';
import 'package:yene_verify/features/profile/presentation/providers/verification_accounts_provider.dart';
import 'package:yene_verify/features/profile/presentation/screens/verification_accounts_screen.dart';

import '../sub_merchants/team_harness.dart';

class _FakeAuthRepository extends AuthRepository {
  _FakeAuthRepository()
      : super(
          sessionStore: SessionStore(SecureStorage(), InMemoryTokenStore()),
          api: AuthApi(Dio()),
        );

  String? lastPin;

  @override
  Future<ApiResult<StepUpResponse>> verifyPin({required String pin}) async {
    lastPin = pin;
    return const Success(
      StepUpResponse(stepUpToken: 'step-up-token', expiresIn: 300),
    );
  }
}

class _FakeAccountsApi extends VerificationAccountsApi {
  _FakeAccountsApi() : super(Dio());

  int updateCalls = 0;
  VerificationAccounts? lastAccounts;
  String? lastToken;
  ApiResult<VerificationAccounts>? updateResult;

  @override
  Future<ApiResult<VerificationAccounts>> get() async =>
      const Success(VerificationAccounts());

  @override
  Future<ApiResult<VerificationAccounts>> update({
    required VerificationAccounts accounts,
    required String stepUpToken,
  }) async {
    updateCalls++;
    lastAccounts = accounts;
    lastToken = stepUpToken;
    return updateResult ?? Success(accounts);
  }
}

Future<void> _pumpScreen(
  WidgetTester tester, {
  required VerificationAccounts initial,
  required _FakeAuthRepository auth,
  required _FakeAccountsApi api,
}) async {
  tester.view.physicalSize = const Size(1000, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(teamTestApp(
    const VerificationAccountsScreen(),
    overrides: [
      verificationAccountsProvider.overrideWith((ref) async => initial),
      verificationAccountsApiProvider.overrideWithValue(api),
      authRepositoryProvider.overrideWithValue(auth),
    ],
  ));
  await tester.pumpAndSettle();
}

AppButton _saveButton(WidgetTester tester) =>
    tester.widget<AppButton>(find.widgetWithText(AppButton, 'Save'));

void main() {
  group('VerificationAccounts', () {
    test('parses the wrapped GET/PUT response shape', () {
      final accounts = VerificationAccounts.fromJson({
        'verificationAccounts': {
          'cbe': {'last8': '12345678'},
          'abyssinia': {'last5': '54321'},
          'awash': {'accountNumber': '0130012345678'},
        },
      });

      expect(accounts.cbeLast8, '12345678');
      expect(accounts.abyssiniaLast5, '54321');
      expect(accounts.awashAccountNumber, '0130012345678');
    });

    test('also parses an already-unwrapped payload', () {
      final accounts = VerificationAccounts.fromJson({
        'cbe': {'last8': '87654321'},
      });

      expect(accounts.cbeLast8, '87654321');
      expect(accounts.abyssiniaLast5, isNull);
      expect(accounts.isEmpty, isFalse);
    });

    test('toPatch sends null for cleared banks so the merge removes them', () {
      const accounts = VerificationAccounts(cbeLast8: '12345678');

      expect(accounts.toPatch(), {
        'cbe': {'last8': '12345678'},
        'abyssinia': null,
        'awash': null,
      });
      expect(const VerificationAccounts().isEmpty, isTrue);
    });
  });

  group('VerificationAccountsScreen', () {
    testWidgets('renders the three banks with the stored values',
        (tester) async {
      final api = _FakeAccountsApi();
      await _pumpScreen(
        tester,
        initial: const VerificationAccounts(
          cbeLast8: '12345678',
          abyssiniaLast5: '54321',
        ),
        auth: _FakeAuthRepository(),
        api: api,
      );

      expect(find.text('Commercial Bank of Ethiopia (CBE)'), findsOneWidget);
      expect(find.text('Bank of Abyssinia'), findsOneWidget);
      expect(find.text('Awash Bank'), findsOneWidget);

      final fields = tester
          .widgetList<TextFormField>(find.byType(TextFormField))
          .toList();
      expect(fields[0].controller?.text, '12345678');
      expect(fields[1].controller?.text, '54321');
      expect(fields[2].controller?.text, '');
      expect(_saveButton(tester).onPressed, isNotNull);
    });

    testWidgets('a partial CBE number shows an error and disables Save',
        (tester) async {
      await _pumpScreen(
        tester,
        initial: const VerificationAccounts(),
        auth: _FakeAuthRepository(),
        api: _FakeAccountsApi(),
      );

      await tester.enterText(find.byType(TextFormField).at(0), '123');
      await tester.pumpAndSettle();

      expect(find.text('Enter exactly 8 digits'), findsOneWidget);
      expect(_saveButton(tester).onPressed, isNull);
    });

    testWidgets('saving prompts for the PIN, then PUTs with the step-up token',
        (tester) async {
      final auth = _FakeAuthRepository();
      final api = _FakeAccountsApi();
      await _pumpScreen(
        tester,
        initial: const VerificationAccounts(),
        auth: auth,
        api: api,
      );

      await tester.enterText(find.byType(TextFormField).at(0), '12345678');
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(AppButton, 'Save'));
      await tester.pumpAndSettle();

      expect(find.text('Confirm with your PIN'), findsOneWidget);
      await tester.enterText(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.byType(TextField),
        ),
        '5729',
      );
      await tester.pumpAndSettle();

      expect(auth.lastPin, '5729');
      expect(api.updateCalls, 1);
      expect(api.lastToken, 'step-up-token');
      expect(api.lastAccounts?.cbeLast8, '12345678');
      expect(api.lastAccounts?.abyssiniaLast5, isNull);
      expect(api.lastAccounts?.awashAccountNumber, isNull);
      expect(find.text('Verification accounts saved'), findsOneWidget);
    });
  });
}
