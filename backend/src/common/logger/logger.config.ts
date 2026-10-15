import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';
import type { Params } from 'nestjs-pino';
import { pinoRedactConfig } from './redact';

/** Builds nestjs-pino LoggerModule options based on environment. */
export function buildLoggerOptions(isDev: boolean, logLevel: string): Params {
  return {
    pinoHttp: {
      level: logLevel,
      redact: pinoRedactConfig,
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: false,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          }
        : undefined,

      // Attach request ID to every log line
      genReqId: (req: IncomingMessage) =>
        (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),

      // Add user context from request
      customProps: (req: IncomingMessage) => {
        const { id, user } = req as IncomingMessage & {
          id?: string;
          user?: { id?: string; merchantId?: string };
        };
        return {
          requestId: id,
          userId: user?.id,
          merchantId: user?.merchantId,
        };
      },

      serializers: {
        req: (req: { method: string; url: string; id: string }) => ({
          method: req.method,
          url: req.url,
          requestId: req.id,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    },
  };
}
