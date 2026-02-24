const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Express-validator result checker middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msgs = errors.array().map((e) => e.msg);
    throw new ApiError(400, msgs[0], errors.array());
  }
  next();
};

module.exports = validate;
