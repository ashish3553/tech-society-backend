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