import type { ApiError } from '@doorpin/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';

type ErrorDetails = NonNullable<ApiError['error']['details']>;

/** The shared JSON error body. `details` lists what was wrong in a request body. */
export function errorBody(code: string, message: string, details?: ErrorDetails): ApiError {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

/** Answers any request that no route handled. */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json(errorBody('NOT_FOUND', 'No such endpoint.'));
};

/**
 * Turns any error into the shared JSON error shape.
 * Client mistakes (4xx) get a short explanation; anything else is a 500 whose details stay in the log.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const type: unknown = err?.type;
  const status: unknown = err?.status;

  if (type === 'entity.parse.failed') {
    res.status(400).json(errorBody('INVALID_JSON', 'Request body is not valid JSON.'));
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json(errorBody('PAYLOAD_TOO_LARGE', 'Request body is too large.'));
    return;
  }
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json(errorBody('BAD_REQUEST', 'The request could not be processed.'));
    return;
  }

  req.log.error({ err }, 'unhandled error');
  res.status(500).json(errorBody('INTERNAL_ERROR', 'Something went wrong on our side.'));
};
