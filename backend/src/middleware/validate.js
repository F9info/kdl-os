import { errorResponse } from '../shared/utils/response.js';

export const validate = (schema) => {
  const handler = (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const errors = result.error.flatten();
      return errorResponse(res, 'Validation failed', 422, errors);
    }

    req.validated = result.data;
    next();
  };
  // Lets the OpenAPI generator read this route's request schema (shared/openapi/spec.js).
  handler.schema = schema;
  return handler;
};
