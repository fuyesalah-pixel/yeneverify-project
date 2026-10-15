import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { AppConfigService } from '../config';

export function setupSwagger(app: INestApplication, cfg: AppConfigService): void {
  // In production, require explicit opt-in via ENABLE_SWAGGER env var
  if (cfg.runtime.isProd) return;

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Yene Verify API')
      .setDescription(
        'Payment receipt verification platform for Ethiopian businesses.\n\n' +
          'Verify CBE, Telebirr, Awash, Dashen, Abyssinia, M-Pesa, and Zemen receipts in under 10 seconds.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'access-token' },
        'access-token',
      )
      .addTag('Auth', 'Phone OTP authentication, PIN, biometric, device management')
      .addTag('Verifications', 'Receipt verification pipeline')
      .addTag('Transactions', 'Verified transaction history')
      .addTag('Credits', 'Credit balance and ledger')
      .addTag('Billing', 'Package selection and payment verification')
      .addTag('Merchants', 'Merchant profile and settings')
      .addTag('SubMerchants', 'Team member management')
      .addTag('Analytics', 'Rule-based business insights')
      .addTag('Notifications', 'Push and in-app notifications')
      .addTag('Exports', 'PDF and CSV report exports')
      .addTag('Health', 'Service health checks')
      .build(),
  );

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Yene Verify API Docs',
  });
}
