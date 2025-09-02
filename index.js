require('dotenv').config();
const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const rateLimit     = require('express-rate-limit');
const connectDB     = require('./config/db');

// Route handlers
const authRoutes            = require('./routes/auth');
const questionRoutes        = require('./routes/questions');
const questionUsageRouter   = require('./routes/questionUsage');
const assignmentRoutes      = require('./routes/assignments');
const submissionRoutes      = require('./routes/submissions');
const uploadRoutes          = require('./routes/upload');
const userRoutes            = require('./routes/users');
const codeSubmissionRoutes  = require('./routes/codeSubmission');

// Auth middleware & error handler
const auth                  = require('./middleware/auth');
const errorHandler          = require('./middleware/errorHandler');
const { codeExecutionLimiter } = require('./middleware/rateLimiter');

// ---- Connect DB (will log/connect or exit on failure)
connectDB();

const app = express();

// ---- Trust Railway proxy
app.set('trust proxy', 1);

// ---- Build CORS allowlist
const envAllow = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Default allowlist: localhost, any vercel.app, any railway.app, any practicearena.com
const defaultAllow = [
  'http://localhost:3000',
  'http://localhost:5173',
  /\.vercel\.app$/,
  /\.railway\.app$/,
  /^https:\/\/.*practicearena\.com$/
];

// Origin matcher that supports strings & regexes
const isAllowedOrigin = (origin, list) => {
  if (!origin) return true; // allow curl/postman
  for (const entry of list) {
    if (entry instanceof RegExp && entry.test(origin)) return true;
    if (typeof entry === 'string' && entry === origin) return true;
  }
  return false;
};

const corsAllowlist = [...envAllow, ...defaultAllow];

const corsOptions = {
  origin: (origin, cb) =>
    isAllowedOrigin(origin, corsAllowlist)
      ? cb(null, true)
      : cb(new Error(`CORS blocked: ${origin}`)),
  credentials: true,
  optionsSuccessStatus: 200
};

// ---- Security & body parsing
app.disable('x-powered-by');
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' } // allow CDN images, etc.
  })
);
app.use(express.json({ limit: '10mb' }));

// ---- Basic request logger (no extra deps)
app.use((req, _res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ip:${req.ip} ua:${req.headers['user-agent'] || 'n/a'}`
  );
  next();
});

// ---- Public sanity routes (before anything else)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'Tech Society Backend API',
    message: 'Server is running successfully',
    ts: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    ts: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Introspection helper to debug networking/proxy headers quickly
app.get('/api/whoami', (req, res) => {
  res.json({
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    ips: req.ips,
    host: req.headers.host,
    origin: req.headers.origin,
    forwardedFor: req.headers['x-forwarded-for'],
    userAgent: req.headers['user-agent']
  });
});

// ---- Global rate limiter (kept modest)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    }
  })
);

// ---- Public (no auth) routes
app.use('/api/auth', authRoutes);

// ---- Mixed/public usage analytics routes first
app.use('/api/questions', questionUsageRouter);

// ---- Protected routes (JWT)
app.use('/api/questions',    auth, questionRoutes);
app.use('/api/assignments',  auth, assignmentRoutes);
app.use('/api/assignments',  auth, submissionRoutes);
app.use('/api/upload',       auth, uploadRoutes);
app.use('/api/users',        auth, userRoutes);
app.use('/api/stats',        auth, require('./routes/stats'));

// ---- Code execution routes (with specific limiter)
app.use('/api/code-exec', codeExecutionLimiter, require('./routes/codeExecution'));

// ---- Code submission routes (some endpoints may be public; adjust inside)
app.use('/api', codeSubmissionRoutes);

// ---- Sessions (if used)
app.use('/api/sessions', require('./routes/sessions'));

// ---- 404 catcher (after all routes)
app.use((req, res, next) => {
  console.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
  return res.status(404).json({
    success: false,
    message: 'Route not found',
    method: req.method,
    path: req.originalUrl
  });
});

// ---- Centralized error handler
app.use(errorHandler);

// ---- Boot logs (no secrets)
const PORT = process.env.PORT || 5000;
console.log('🔧 Environment check:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', PORT);
console.log('- MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('- JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('- PISTON_URL:', (process.env.PISTON_URL || 'not set'));
console.log('- CLIENT_URL:', (process.env.CLIENT_URL || 'not set'));
if (process.env.CORS_ORIGINS) {
  console.log('- CORS_ORIGINS (env):', process.env.CORS_ORIGINS);
}
console.log('- Effective CORS allowlist:', corsAllowlist);

// ---- Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Listening on ${PORT}`);
});

module.exports = app;
