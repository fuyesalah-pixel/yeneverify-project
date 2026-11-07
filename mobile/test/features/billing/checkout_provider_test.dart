import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/features/billing/data/billing_api.dart';
import 'package:yene_verify/features/billing/data/billing_receipt_uploader.dart';
import 'package:yene_verify/features/billing/presentation/providers/checkout_provider.dart';
import 'package:yene_verify/features/verify/data/receipts_api.dart';

import 'billing_harness.dart';

ProviderContainer containerWith({
  required FakeBillingApi api,
  required FakeUploader uploader,
}) {
  final container = ProviderContainer(
    overrides: [
      billingApiProvider.overrideWithValue(api),
      billingReceiptUploaderProvider.overrideWithValue(uploader),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('initiate loads the session into the instructions stage', () async {
    final api = FakeBillingApi(session: sessionFor('BUSINESS'));
    final container =
        containerWith(api: api, uploader: FakeUploader());

    final state = await container.read(checkoutProvider('BUSINESS').future);

    expect(api.initiateCalls, 1);
    expect(api.lastPackageCode, 'BUSINESS');
    expect(state.stage, CheckoutStage.instructions);
    expect(state.session?.packageCode, 'BUSINESS');
    expect(state.session?.instructions.cbeAccountNumber, '1000123456789');
  });

  test('a failed initiate surfaces the backend error', () async {
    final api = FakeBillingApi(
      session: sessionFor('BUSINESS'),
      failure: const ApiError(
        code: 'BILLING_PACKAGE_NOT_PURCHASABLE',
        httpStatus: 400,
      ),
    );
    final container =
        containerWith(api: api, uploader: FakeUploader());

    await expectLater(
      container.read(checkoutProvider('BUSINESS').future),
      throwsA(isA<ApiError>()),
    );
  });

  test('I have paid moves to the upload stage', () async {
    final api = FakeBillingApi(session: sessionFor('BUSINESS'));
    final container =
        containerWith(api: api, uploader: FakeUploader());
    await container.read(checkoutProvider('BUSINESS').future);

    container.read(checkoutProvider('BUSINESS').notifier).showUploadStep();

    expect(
      container.read(checkoutProvider('BUSINESS')).valueOrNull?.stage,
      CheckoutStage.upload,
    );
  });

  test('choosing an image prepares it and stores the preview path', () async {
    final api = FakeBillingApi(session: sessionFor('BUSINESS'));
    final uploader = FakeUploader();
    final container = containerWith(api: api, uploader: uploader);
    await container.read(checkoutProvider('BUSINESS').future);

    final error = await container
        .read(checkoutProvider('BUSINESS').notifier)
        .chooseImage(File('payment.jpg'));

    final state = container.read(checkoutProvider('BUSINESS')).valueOrNull!;
    expect(error, isNull);
    expect(uploader.prepareCalls, 1);
    expect(state.hasImage, isTrue);
    expect(state.imagePath, 'payment.jpg');
    expect(state.stage, CheckoutStage.upload);
  });

  test('submit uploads the receipt, links the session and finishes', () async {
    final api = FakeBillingApi(session: sessionFor('BUSINESS'));
    final uploader = FakeUploader();
    final container = containerWith(api: api, uploader: uploader);
    await container.read(checkoutProvider('BUSINESS').future);

    final notifier = container.read(checkoutProvider('BUSINESS').notifier);
    await notifier.chooseImage(File('payment.jpg'));
    final result = await notifier.submit(inputMethod: InputMethod.upload);

    expect(result, isA<Success<dynamic>>());
    expect(uploader.uploadCalls, 1);
    expect(api.submitCalls, 1);
    expect(api.lastSessionId, 'session-1');
    expect(api.lastReceiptId, 'receipt-1');
    expect(
      container.read(checkoutProvider('BUSINESS')).valueOrNull?.stage,
      CheckoutStage.done,
    );
  });

  test('submit without an image fails without calling the API', () async {
    final api = FakeBillingApi(session: sessionFor('BUSINESS'));
    final uploader = FakeUploader();
    final container = containerWith(api: api, uploader: uploader);
    await container.read(checkoutProvider('BUSINESS').future);

    final result = await container
        .read(checkoutProvider('BUSINESS').notifier)
        .submit(inputMethod: InputMethod.upload);

    expect(result, isA<Failure<dynamic>>());
    expect(api.submitCalls, 0);
  });

  test('a failed upload keeps the merchant on the upload step', () async {
    final api = FakeBillingApi(session: sessionFor('BUSINESS'));
    final uploader = FakeUploader(
      failure: const ApiError(code: 'RECEIPT_NOT_UPLOADED', httpStatus: 500),
    );
    final container = containerWith(api: api, uploader: uploader);
    await container.read(checkoutProvider('BUSINESS').future);

    final notifier = container.read(checkoutProvider('BUSINESS').notifier);
    await notifier.chooseImage(File('payment.jpg'));
    final result = await notifier.submit(inputMethod: InputMethod.upload);

    expect(result, isA<Failure<dynamic>>());
    expect(api.submitCalls, 0);
    final state = container.read(checkoutProvider('BUSINESS')).valueOrNull!;
    expect(state.stage, CheckoutStage.upload);
    expect(state.error?.code, 'RECEIPT_NOT_UPLOADED');
  });

  test('removeImage clears the screenshot', () async {
    final api = FakeBillingApi(session: sessionFor('BUSINESS'));
    final container = containerWith(api: api, uploader: FakeUploader());
    await container.read(checkoutProvider('BUSINESS').future);
    final notifier = container.read(checkoutProvider('BUSINESS').notifier);

    await notifier.chooseImage(File('payment.jpg'));
    notifier.removeImage();

    final state = container.read(checkoutProvider('BUSINESS')).valueOrNull!;
    expect(state.hasImage, isFalse);
    expect(state.imagePath, isNull);
  });
}
