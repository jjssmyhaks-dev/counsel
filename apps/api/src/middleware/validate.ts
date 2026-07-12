import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../lib/errors';

/**
 * Zod-based request validation middleware.
 *
 * Validates req.query, req.body, or req.params against a Zod schema.
 * Throws a ValidationError with human-readable messages on failure.
 *
 * Usage:
 *   router.post('/', validate('body', createSchema), handler);
 */
export function validate(
  source: 'body' | 'query' | 'params',
  schema: ZodSchema,
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      // Replace with parsed (and transformed/coerced) data
      req[source] = data;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        next(new ValidationError(message));
      } else {
        next(err);
      }
    }
  };
}
