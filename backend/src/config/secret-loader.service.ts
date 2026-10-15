import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';
import type { Env } from './env.schema';

/**
 * Small provider boundary for secrets.
 *
 * Today the provider is the already-validated process environment. The
 * interface is intentionally narrow so a future Vault or AWS Secrets
 * Manager implementation can replace it without changing business code.
 * No secret value is ever logged, returned to a controller, or included in
 * an exception message.
 */
export interface SecretProvider {
  get(key: keyof Env): string;
  readFile(path: string): string;
}

/** Directories from which file-backed credentials may be read. */
function approvedSecretRoots(): string[] {
  return [
    '/run/secrets',
    resolve(process.cwd(), 'docker', 'secrets'),
    resolve(process.cwd(), 'secrets'),
    resolve(process.cwd(), '..', 'docker', 'secrets'),
    resolve(process.cwd(), '..', 'secrets'),
  ];
}

function isApprovedSecretPath(path: string): boolean {
  const candidate = resolve(path);
  return approvedSecretRoots().some((root) => {
    const rootPath = resolve(root);
    return candidate === rootPath || candidate.startsWith(`${rootPath}${sep}`);
  });
}

@Injectable()
export class EnvironmentSecretProvider implements SecretProvider {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get(key: keyof Env): string {
    const value = this.config.get(key);
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  }

  readFile(path: string): string {
    if (!path || (!isAbsolute(path) && !path.startsWith('./') && !path.startsWith('../'))) {
      throw new Error('Secret file path is not a valid mounted-file path.');
    }
    if (!isApprovedSecretPath(path)) {
      throw new Error('Secret file path is outside the approved secret roots.');
    }

    try {
      return readFileSync(resolve(path), 'utf8');
    } catch {
      // Do not include the path or filesystem error in a client-visible error.
      throw new Error('A required secret file could not be read.');
    }
  }
}

/** Convenience facade used by adapters that need file-backed credentials. */
@Injectable()
export class SecretLoader {
  constructor(private readonly provider: EnvironmentSecretProvider) {}

  value(key: keyof Env): string {
    return this.provider.get(key);
  }

  file(path: string): string {
    return this.provider.readFile(path);
  }

  /** Parse the mounted Vision service-account JSON without exposing it. */
  visionCredentials(): unknown {
    const path = this.provider.get('VISION_CREDENTIALS_JSON');
    if (!path) throw new Error('Vision credentials are not configured.');

    try {
      return JSON.parse(this.file(path)) as unknown;
    } catch {
      throw new Error('Vision credentials are not valid JSON.');
    }
  }

  /** Convert the escaped newline form used by deployment panels. */
  fcmPrivateKey(): string {
    const filePath = this.provider.get('FCM_PRIVATE_KEY_FILE');
    const source = filePath ? this.file(filePath) : this.provider.get('FCM_PRIVATE_KEY');
    return source.replace(/\\n/g, '\n');
  }
}
