export const successResponse = (res, data = null, statusCode = 200) => {
  return res.status(statusCode).json({ success: true, data });
};

export const errorResponse = (res, message = 'Internal server error', statusCode = 500, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};
