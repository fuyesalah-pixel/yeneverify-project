// ============================================================
// Yene Verify — Internal Storage Controller
//
// Backs the local storage driver: the "presigned" PUT/GET URLs it mints
// point here. Every request must carry a valid HMAC token, and both
// routes 404 when STORAGE_DRIVER is not `local`, so these endpoints do
// not exist at all in staging or production.
//
// Keys look like `receipts/<merchantId>/<uuid>.jpg`, so the routes capture
// the whole remaining path with `:key(.*)`. (Express 4 bundles
// path-to-regexp 0.1.x, where `*key` is not a named splat — it compiles to
// `(.*)key`, i.e. a literal trailing "key" — while `:key(.*)` works.)
// ============================================================

import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { LocalDriver } from '../storage/drivers/local.driver';
import { StorageService } from '../storage/storage.service';

// Dev/dev-staging-only transport endpoints: access is authorized by the
// HMAC upload/download token in the query string, NOT by session JWTs —
// presigned URLs must be usable by a bare HTTP client (image body + one
// query param). @Public() opts the routes out of JwtAuthGuard and
// TenantGuard; assertToken() then enforces the real authorization, and
// assertLocal() keeps them 404 in every non-local environment.
@Public()
// Versioned explicitly ('1') so the presigned uploadUrl stays
// /api/v1/internal/... now that no defaultVersion exists.
@Controller({ path: 'internal', version: '1' })
export class InternalStorageController {
  constructor(
    private readonly storage: StorageService,
    private readonly local: LocalDriver,
  ) {}

  /** Client upload target for the local driver. */
  @Put('storage-upload/:key(.*)')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async upload(
    @Param('key') keyParam: string | string[],
    @Query('token') token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.assertLocal();
    const key = this.normalizeKey(keyParam);
    this.assertToken(key, token);

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    const body = Buffer.concat(chunks);

    await this.local.putObject(key, body);
    res.status(HttpStatus.OK).json({ ok: true, sizeBytes: body.length });
  }

  /** Client download target for the local driver. */
  @Get('storage-object/:key(.*)')
  @ApiExcludeEndpoint()
  @Header('Cross-Origin-Resource-Policy', 'same-site')
  async download(
    @Param('key') keyParam: string | string[],
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    this.assertLocal();
    const key = this.normalizeKey(keyParam);
    this.assertToken(key, token);

    const head = await this.local.head(key);
    if (!head?.exists) {
      throw new NotFoundException();
    }

    const body = await this.local.getObject(key);
    res.status(HttpStatus.OK).send(body);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private assertLocal(): void {
    if (!this.storage.isLocalDriver()) {
      throw new NotFoundException();
    }
  }

  private assertToken(key: string, token: string | undefined): void {
    if (!token || !this.local.verifyToken(key, token)) {
      throw new NotFoundException();
    }
  } /** Wildcard params arrive as an array or with a leading slash. */
  private normalizeKey(keyParam: string | string[]): string {
    const raw = Array.isArray(keyParam) ? keyParam.join('/') : keyParam;
    return raw.replace(/^\/+/, '');
  }
}
