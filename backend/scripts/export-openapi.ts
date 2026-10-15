/**
 * Yene Verify — OpenAPI spec exporter
 * Usage:  ts-node scripts/export-openapi.ts
 * Check:  ts-node scripts/export-openapi.ts --check
 *
 * Boots the NestJS app in a headless mode, generates the OpenAPI document,
 * and writes it to shared/contracts/openapi.yaml with an AUTO-GENERATED header.
 * CI fails when --check is passed and the output differs from the committed file.
 */

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, sep } from 'path';
import * as yaml from 'js-yaml';

async function main() {
  const isCheck = process.argv.includes('--check');

  // Some machines export a bogus global PORT (e.g. 0); the .env file wins.
  if (process.env.PORT !== undefined && Number(process.env.PORT) < 1) {
    delete process.env.PORT;
  }

  // Dynamically import to avoid loading the full app at the top level
  const { AppModule } = await import('../src/app.module');

  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Yene Verify API')
      .setDescription('Payment receipt verification for Ethiopian banks')
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build(),
  );

  const header =
    '# AUTO-GENERATED — do not hand-edit this file.\n' +
    '# Source: backend NestJS Swagger module.\n' +
    '# Regenerate: cd backend && npm run openapi:export\n' +
    '# Consumed by: scripts/gen-api-client.sh → mobile/lib/api/generated/\n' +
    '#\n';

  // Under ts-node __dirname is <backend>/scripts; from the compiled output it is
  // <backend>/dist-scripts/scripts. Anchor on the backend root in both cases.
  const isCompiled = __dirname.includes(`${sep}dist-scripts${sep}`);
  const backendRoot = resolve(__dirname, isCompiled ? '..' : '..', '..');
  const outputPath = resolve(backendRoot, '..', 'shared/contracts/openapi.yaml');
  const generated  = header + yaml.dump(document, { lineWidth: 120 });

  if (isCheck) {
    if (!existsSync(outputPath)) {
      process.stderr.write('❌ openapi.yaml does not exist. Run: npm run openapi:export\n');
      process.exit(1);
    }
    const committed = readFileSync(outputPath, 'utf8');
    if (committed !== generated) {
      process.stderr.write(
        '❌ openapi.yaml is out of sync. Run: npm run openapi:export and commit.\n',
      );
      process.exit(1);
    }
    process.stdout.write('✅ openapi.yaml is in sync.\n');
  } else {
    writeFileSync(outputPath, generated, 'utf8');
    process.stdout.write(`✅ openapi.yaml written to ${outputPath}\n`);
  }

  await app.close();
}

main().catch((e) => {
  process.stderr.write(`❌ Export failed: ${String(e)}\n`);
  process.exit(1);
});
