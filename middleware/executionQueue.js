// middleware/executionQueue.js - Address sequential execution limitation
const Queue = require('bull');
const Redis = require('redis');

class ExecutionQueue {
  constructor() {
    // Redis connection for queue management
    this.redis = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    });

    // Create execution queue with concurrency control
    this.queue = new Queue('code execution', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50,      // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    // Process jobs with controlled concurrency
    this.queue.process('execute-code', 5, this.processExecution.bind(this));
    
    // Error handling
    this.queue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err.message);
    });
  }

  // Add execution job to queue
  async addExecutionJob(jobData) {
    const { language, code, testCases, userId, priority = 'normal' } = jobData;
    
    const job = await this.queue.add('execute-code', {
      language,
      code,
      testCases,
      userId,
      timestamp: Date.now()
    }, {
      priority: priority === 'high' ? 10 : 1,
      delay: 0
    });

    return job.id;
  }

  // Process individual execution job
  async processExecution(job) {
    const { language, code, testCases } = job.data;
    const pistonService = require('../services/pistonService');

    try {
      // Update job progress
      job.progress(10);

      const result = await pistonService.executeWithTestCases(language, code, testCases);
      
      job.progress(100);
      return result;
    } catch (error) {
      throw new Error(`Execution failed: ${error.message}`);
    }
  }

  // Get job status and result
  async getJobResult(jobId) {
    const job = await this.queue.getJob(jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }

    return {
      id: job.id,
      status: await job.getState(),
      progress: job.progress(),
      result: job.returnvalue,
      failedReason: job.failedReason,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null
    };
  }

  // Get queue statistics
  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(), 
      this.queue.getCompleted(),
      this.queue.getFailed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length
    };
  }
}

module.exports = new ExecutionQueue();


// routes/codeExecution.js - Updated with caching and queue support
const express = require('express');
const router = express.Router();
const pistonService = require('../services/pistonService');
const executionCache = require('../middleware/executionCache');
const codeValidator = require('../utils/codeValidation');

// Enhanced test endpoint with caching
router.post('/test', async (req, res) => {
  try {
    const { language, code, input = '' } = req.body;

    // Validate input
    const codeValidation = codeValidator.validateCode(code);
    if (!codeValidation.valid) {
      return res.status(400).json({
        success: false,
        message: codeValidation.message
      });
    }

    const languageValidation = codeValidator.validateLanguage(language);
    if (!languageValidation.valid) {
      return res.status(400).json({
        success: false,
        message: languageValidation.message
      });
    }

    // Check cache first
    const cachedResult = await executionCache.get(language, code, input);
    if (cachedResult) {
      return res.json({
        success: true,
        data: {
          output: cachedResult.stdout || '',
          error: cachedResult.stderr || cachedResult.error || '',
          success: cachedResult.success,
          executionTime: cachedResult.executionTime,
          fromCache: true
        }
      });
    }

    // Execute with Piston
    const result = await pistonService.executeCode(language, code, input);
    
    // Cache successful results
    await executionCache.set(language, code, input, result);

    res.json({
      success: true,
      data: {
        output: result.stdout || '',
        error: result.stderr || result.error || '',
        success: result.success,
        executionTime: result.executionTime,
        fromCache: false
      }
    });

  } catch (error) {
    console.error('Code test error:', error);
    res.status(500).json({
      success: false,
      message: 'Code test failed',
      error: error.message
    });
  }
});

// Enhanced run endpoint with better error reporting
router.post('/run', async (req, res) => {
  try {
    const { language, code, testCases = [] } = req.body;

    // Validate all inputs
    const codeValidation = codeValidator.validateCode(code);
    if (!codeValidation.valid) {
      return res.status(400).json({
        success: false,
        message: codeValidation.message
      });
    }

    const languageValidation = codeValidator.validateLanguage(language);
    if (!languageValidation.valid) {
      return res.status(400).json({
        success: false,
        message: languageValidation.message
      });
    }

    // Validate test cases
    if (testCases.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Too many test cases (maximum 20 allowed)'
      });
    }

    let result;

    if (testCases.length > 0) {
      // Execute with test cases
      result = await pistonService.executeWithTestCases(language, code, testCases);
    } else {
      // Simple execution without test cases
      const execResult = await pistonService.executeCode(language, code, '');
      result = {
        passedTestCases: execResult.success ? 1 : 0,
        totalTestCases: 1,
        testResults: [{
          testCase: 1,
          input: '',
          expectedOutput: 'Program should run without errors',
          actualOutput: execResult.stdout || '',
          passed: execResult.success,
          error: execResult.error,
          stderr: execResult.stderr,
          executionTime: execResult.executionTime
        }],
        score: execResult.success ? 100 : 0
      };
    }

    // Add execution metadata
    result.metadata = {
      language,
      totalExecutionTime: result.testResults.reduce((sum, r) => sum + (r.executionTime || 0), 0),
      timestamp: new Date().toISOString(),
      pistonVersion: 'latest'
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Code execution error:', error);
    res.status(500).json({
      success: false,
      message: 'Code execution failed',
      error: error.message
    });
  }
});

// Enhanced health endpoint with detailed diagnostics
router.get('/health', async (req, res) => {
  try {
    const health = await pistonService.healthCheck();
    const cacheStats = executionCache.getCacheStats();
    
    res.json({
      success: true,
      data: {
        ...health,
        cache: cacheStats,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});

// Get detailed language information
router.get('/languages', async (req, res) => {
  try {
    const stats = await pistonService.getLanguageStats();
    
    res.json({
      success: true,
      data: {
        supported: stats.supported,
        total: stats.total,
        languages: stats.languages,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch languages',
      error: error.message
    });
  }
});

// Cache management endpoint (for admin)
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = executionCache.getCacheStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get cache stats'
    });
  }
});

// Clear cache endpoint (for admin)
router.delete('/cache', async (req, res) => {
  try {
    executionCache.cache.clear();
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache'
    });
  }
});

module.exports = router;