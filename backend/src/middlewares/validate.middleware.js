const { validationError } = require('../utils/response');

/**
 * Joi validation middleware factory.
 * Usage: validate(schema) — validates req.body by default.
 * Usage: validate(schema, 'query') — validates req.query.
 */
const validate = (schema, target = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[target], { abortEarly: false, stripUnknown: true });
  if (error) {
    const details = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message,
    }));
    return validationError(res, details);
  }
  req[target] = value;
  return next();
};

module.exports = { validate };
