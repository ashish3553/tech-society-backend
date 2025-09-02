require('dotenv').config();
const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const rateLimit     = require('express-rate-limit');
const connectDB     = require('./config/db');
const validateEnv   = require('./utils/validateEnv');

// Route handlers
const authRoutes            = require('./routes/auth');
const questionRoutes        = require('./routes/questions');
const questionUsageRouter   = require('./routes/questionUsage');
const assignmentRoutes      = require('./routes/assignments');
const submissionRoutes      = require('./routes/submissions');
const uploadRoutes          = require('./routes/upload');
const userRoutes            = require('./routes/users');
const codeSubmissionRoutes  = require('./routes/codeSubmission');
const diagnosticsRouter     = require('./routes/diagnostics');

// Auth middleware & error handler
const auth                  = require('./middleware/auth');
const errorHandler          = require('./middleware/errorHandler');
const { codeExecutionLimiter } = require('./middleware/rateLimiter');

// 0) Validate env quickly (don’t crash; just log)
const envReport = validateEnv();
if (envReport.errors.length) {
  console.error('❌ ENV ERRORS:\n- ' + envReport.errors.join('\n- '));
}
if (envReport.warns.length) {
  console.warn('⚠️  ENV WARNINGS:\n- ' + envReport.warns.join('\n- '));
}

// 1) DB connect
connectDB();

const app = express();

app.set('trust proxy', 1); // required behind Railway

// 2) CORS
const envAllow = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const defaultAllow = [
  'http://localhost:3000',
  'http://localhost:5173',
  /\.vercel\.app$/,
  /\.railway\.app$/,
  /^https:\/\/.*practicearena\.com$/
];
const isAllowedOrigin = (origin, list) => {
  if (!origin) return true;
  for (const entry of list) {
    if (entry instanceof RegExp && entry.test(origin)) return true;
    if (typeof entry === 'string' && entry === origin) return true;
  }
  return false;
};
const corsAllowlist = [...envAllow, ...defaultAllow];


const corsOptions = {
  origin: [
    'https://practicearenauieth.vercel.app', // your current frontend URL
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};


app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 3) Security & body parsing
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '10mb' }));

// 4) Tiny request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ip:${req.ip}`);
  next();
});

// 5) Sanity & health
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
app.get('/api/whoami', (req, res) => {
  res.json({
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    ips: req.ips,
    host: req.headers.host,
    origin: req.headers.origin,
    forwardedFor: req.headers['x-forwarded-for'] || null,
    ua: req.headers['user-agent'] || null
  });
});

// 6) Global rate limit
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
}));

// 7) Public routes
app.use('/api/auth', auth);

// 7.1) Diagnostics (no auth; keep!)
app.use('/api/diagnostics', diagnosticsRouter);

// 8) Mixed/public usage analytics routes first
app.use('/api/questions', questionUsageRouter);

// 9) Protected routes
app.use('/api/questions',    auth, questionRoutes);
app.use('/api/assignments',  auth, assignmentRoutes);
app.use('/api/assignments',  auth, submissionRoutes);
app.use('/api/upload',       auth, uploadRoutes);
app.use('/api/users',        auth, userRoutes);
app.use('/api/stats',        auth, require('./routes/stats'));

// 10) Code execution routes (with limiter)
app.use('/api/code-exec', codeExecutionLimiter, require('./routes/codeExecution'));

// 11) Code submissions
app.use('/api', codeSubmissionRoutes);

// 12) Sessions
app.use('/api/sessions', require('./routes/sessions'));

// 13) 404
app.use((req, res, next) => {
  console.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ success: false, message: 'Route not found', method: req.method, path: req.originalUrl });
});

// 14) Central error handler
app.use(errorHandler);

// 15) Boot logs
console.log('🔧 Environment check:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', PORT);
console.log('- MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('- JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('- PISTON_URL:', process.env.PISTON_URL || 'not set');
console.log('- CLIENT_URL:', process.env.CLIENT_URL || 'not set');
if (process.env.CORS_ORIGINS) console.log('- CORS_ORIGINS:', process.env.CORS_ORIGINS);
console.log('- Effective CORS allowlist:', corsAllowlist);

// 16) Start
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
});
module.exports = app;
