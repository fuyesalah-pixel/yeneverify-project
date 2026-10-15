import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { newId } from '../utils/id.util';

/**
 * Ensures every request has an x-request-id header.
 * If the client supplies one, it is kept.
 * If missing, a new UUID v7 is generated.
 * The ID is attached to req.id and echoed in the response header.
 * Registered globally in AppModule.configure().
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers['x-request-id'] as string | undefined) ?? newId();
    (req as Request & { id: string }).id = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
