// utils/validateEnv.js
module.exports = function validateEnv() {
  const errors = [];
  const warns  = [];

  const must = (name, pred = v => !!v) => {
    const v = process.env[name];
    if (!pred(v)) errors.push(`${name} is missing or invalid`);
    return v;
  };
  const should = (name, pred = v => !!v) => {
    const v = process.env[name];
    if (!pred(v)) warns.push(`${name} is not set`);
    return v;
  };

  // Required
  const MONGODB_URI = must('MONGODB_URI', v => typeof v === 'string' && v.startsWith('mongodb'));
  const JWT_SECRET  = must('JWT_SECRET',  v => typeof v === 'string' && v.length >= 32);

  // Strongly recommended
  const PISTON_URL  = should('PISTON_URL', v => {
    if (!v) return false;
    try { new URL(v); return true; } catch { return false; }
  });

  // Optional / nice-to-have
  should('CLIENT_URL');
  should('MAILJET_API_KEY');
  should('MAILJET_API_SECRET');
  should('CLOUDINARY_CLOUD_NAME');
  should('CLOUDINARY_API_KEY');
  should('CLOUDINARY_API_SECRET');

  return { errors, warns, values: { MONGODB_URI: !!MONGODB_URI, JWT_SECRET: !!JWT_SECRET, PISTON_URL } };
};
