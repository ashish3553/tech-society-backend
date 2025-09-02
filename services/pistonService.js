const axios = require('axios');

class PistonService {
  constructor() {
    this.PISTON_URL = process.env.PISTON_URL || 'http://localhost:2000/api/v2';
    this.timeout = 30000;
  }

  getLanguageConfig(language) {
    const configs = {
      'javascript': { language: 'javascript', version: '20.11.1', fileName: 'solution.js' },
      'python': { language: 'python', version: '3.12.0', fileName: 'solution.py' },
      'java': { language: 'java', version: '15.0.2', fileName: 'Solution.java' },
      'cpp': { language: 'cpp', version: '10.2.0', fileName: 'solution.cpp' },
      'c': { language: 'c', version: '10.2.0', fileName: 'solution.c' }
    };
    
    return configs[language] || null;
  }

  async executeCode(language, code, input = '') {
  try {
    const config = this.getLanguageConfig(language);
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const payload = {
      language: config.language,
      version: config.version,
      files: [{
        name: config.fileName,
        content: code
      }],
      stdin: input,
      compile_timeout: 10000,  // Keep this
      run_timeout: 3000        // CHANGED: Reduced from 5000 to 3000
    };

      const response = await axios.post(`${this.PISTON_URL}/execute`, payload, {
        timeout: this.timeout,
        headers: { 'Content-Type': 'application/json' }
      });

      return this.parseResult(response.data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async executeWithTestCases(language, code, testCases) {
    const results = [];
    let passedCount = 0;

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      
      try {
        const result = await this.executeCode(language, code, testCase.input);
        
        const actualOutput = (result.stdout || '').trim();
        const expectedOutput = (testCase.expected || '').trim();
        const passed = result.success && actualOutput === expectedOutput;
        
        if (passed) passedCount++;

        results.push({
          testCase: i + 1,
          input: testCase.input,
          expectedOutput: expectedOutput,
          actualOutput: actualOutput,
          passed: passed,
          error: result.error || null,
          stderr: result.stderr || '',
          executionTime: result.executionTime || 0
        });

        if (i < testCases.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        results.push({
          testCase: i + 1,
          input: testCase.input,
          expectedOutput: testCase.expected,
          actualOutput: '',
          passed: false,
          error: error.message,
          stderr: '',
          executionTime: 0
        });
      }
    }

    return {
      passedTestCases: passedCount,
      totalTestCases: testCases.length,
      testResults: results,
      score: Math.round((passedCount / testCases.length) * 100)
    };
  }

  parseResult(data) {
    const { compile, run } = data;

    if (compile && compile.code !== 0) {
      return {
        success: false,
        stdout: compile.stdout || '',
        stderr: compile.stderr || '',
        error: 'Compilation Error',
        executionTime: 0
      };
    }

    if (run && run.code !== 0) {
      return {
        success: false,
        stdout: run.stdout || '',
        stderr: run.stderr || '',
        error: 'Runtime Error',
        executionTime: run.execution_time || 0
      };
    }

    return {
      success: true,
      stdout: run ? run.stdout : '',
      stderr: run ? run.stderr : '',
      error: null,
      executionTime: run ? run.execution_time : 0
    };
  }

  handleError(error) {
    console.error('Piston execution error:', error.message);
    
    return {
      success: false,
      stdout: '',
      stderr: '',
      error: error.response?.data?.message || error.message || 'Execution failed',
      executionTime: 0
    };
  }

  async healthCheck() {
    try {
      const response = await axios.get(`${this.PISTON_URL}/runtimes`, {
        timeout: 5000
      });
      
      return {
        status: 'healthy',
        languageCount: response.data.length,
        url: this.PISTON_URL
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        url: this.PISTON_URL
      };
    }
  }
}

module.exports = new PistonService();