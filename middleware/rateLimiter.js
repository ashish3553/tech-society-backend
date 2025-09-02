const rateLimit = require('express-rate-limit');

const codeExecutionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per windowMs
  message: {
    success: false,
    message: 'Too many code execution requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'development';
  }
});

module.exports = { codeExecutionLimiter };