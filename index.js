require('dotenv').config()
const express       = require('express')
const cors          = require('cors')
const helmet        = require('helmet')
const rateLimit     = require('express-rate-limit')
const connectDB     = require('./config/db')

// Route handlers
const authRoutes          = require('./routes/auth')
const questionRoutes      = require('./routes/questions')
const questionUsageRouter = require('./routes/questionUsage')
const assignmentRoutes    = require('./routes/assignments')
const submissionRoutes    = require('./routes/submissions')
const uploadRoutes        = require('./routes/upload')
const userRoutes          = require('./routes/users')
const codeSubmissionRoutes = require('./routes/codeSubmission')

// Auth middleware & error handler
const auth         = require('./middleware/auth')
const errorHandler = require('./middleware/errorHandler')
const { codeExecutionLimiter } = require('./middleware/rateLimiter')

// Connect to database
connectDB()

const app = express()

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://practicearenauleth.vercel.app',
    'https://tech-society-practice-arena-4fn2xrrsg.vercel.app',
    /\.railway\.app$/ // Allow all Railway subdomains
  ],
  credentials: true,
  optionsSuccessStatus: 200
}

// — Base route (for Railway health check)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'Tech Society Backend API',
    message: 'Server is running successfully',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

// — Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development'
  })
})

// — Middleware
app.use(cors(corsOptions))
app.use(helmet())
app.use(express.json({ limit: '10mb' }))

// — Global rate limiter: 100 requests per IP per minute
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
})
app.use(limiter)

// — Public (no auth) routes
app.use('/api/auth', authRoutes)

// — Protected routes (JWT auth required)

// 1️⃣ Mount usage-stats & history routes first
app.use('/api/questions', questionUsageRouter)

// 2️⃣ Then all other question routes
app.use('/api/questions', auth, questionRoutes)

app.use('/api/assignments', auth, assignmentRoutes)
app.use('/api/assignments', auth, submissionRoutes)
app.use('/api/upload',      auth, uploadRoutes) 
app.use('/api/users',       auth, userRoutes)
app.use('/api/stats',       auth, require('./routes/stats'))
app.use('/api/code-exec', codeExecutionLimiter, require('./routes/codeExecution'))
app.use('/api', codeSubmissionRoutes)
app.use('/api/sessions', require('./routes/sessions'))

// — Error handling
app.use(errorHandler)



const PORT = process.env.PORT || 5000

console.log('🔧 Environment check:')
console.log('- NODE_ENV:', process.env.NODE_ENV)
console.log('- PORT:', PORT)
console.log('- MONGODB_URI exists:', !!process.env.MONGODB_URI)
console.log('- JWT_SECRET exists:', !!process.env.JWT_SECRET)


app.get('/', (req, res) => res.json({ ok: true, service: 'tech-society-backend' })); // optional sanity route
app.listen(PORT, '0.0.0.0', () => console.log(`Listening on ${PORT}`));

module.exports = app