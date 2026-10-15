import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../errors/domain-errors';

/**
 * Validates a value against a Zod schema.
 *
 * Usage as method-level pipe:
 *   @Body(new ZodValidationPipe(MyDtoSchema)) body: MyDto
 *
 * Usage as global APP_PIPE (validates all @Body/@Query/@Param):
 *   useGlobalPipes(new ZodValidationPipe())
 *   — requires each DTO to expose a static `schema` property.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, _meta: ArgumentMetadata): unknown {
    if (!this.schema) return value;

    const result = this.schema.safeParse(value);

    if (!result.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || 'root';
        if (!fields[path]) fields[path] = [];
        fields[path].push(issue.message);
      }
      throw new ValidationError('Validation failed', { fields });
    }

    return result.data;
  }
}
