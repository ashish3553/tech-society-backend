// services/judge0Service.js
const axios = require('axios');

class Judge0Service {
  constructor() {
    this.baseURL = process.env.JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com';
    this.apiKey = process.env.JUDGE0_API_KEY || process.env.RAPIDAPI_KEY;
    
    if (!this.apiKey) {
      console.warn('⚠️  Judge0 API key not found. Set JUDGE0_API_KEY or RAPIDAPI_KEY environment variable.');
    }
    
    // Judge0 Language ID mapping
    this.languageIds = {
      javascript: 63, // Node.js
      python: 71,     // Python 3
      cpp: 54,        // C++ (GCC 9.2.0)
      c: 50,          // C (GCC 9.2.0)
      java: 62,       // Java (OpenJDK 13.0.1)
      csharp: 51,     // C# (Mono 6.6.0.161)
      go: 60,         // Go (1.13.5)
      rust: 73,       // Rust (1.40.0)
      php: 68,        // PHP (7.4.1)
      ruby: 72        // Ruby (2.7.0)
    };
  }

  async submitCode(code, language, testCases = []) {
    const languageId = this.languageIds[language.toLowerCase()];
    if (!languageId) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const results = [];
    
    // If no test cases provided, run code with empty input
    if (testCases.length === 0) {
      testCases = [{ input: '', expected: '' }];
    }
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      
      try {
        console.log(`🧪 Running test case ${i + 1}/${testCases.length}`);
        
        // Submit code to Judge0
        const submissionResponse = await axios.post(`${this.baseURL}/submissions`, {
          source_code: Buffer.from(code).toString('base64'),
          language_id: languageId,
          stdin: Buffer.from(testCase.input || '').toString('base64'),
          expected_output: Buffer.from(testCase.expected || '').toString('base64')
        }, {
          headers: {
            'X-RapidAPI-Key': this.apiKey,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        const token = submissionResponse.data.token;
        
        // Poll for result with exponential backoff
        let result;
        let attempts = 0;
        const maxAttempts = 15;
        
        do {
          const waitTime = Math.min(1000 * Math.pow(1.5, attempts), 5000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          result = await axios.get(`${this.baseURL}/submissions/${token}`, {
            headers: {
              'X-RapidAPI-Key': this.apiKey,
              'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
            },
            timeout: 10000
          });
          
          attempts++;
          console.log(`📊 Polling attempt ${attempts}, status: ${result.data.status.description}`);
          
        } while (result.data.status.id <= 2 && attempts < maxAttempts);

        // Process result
        const output = result.data.stdout ? 
          Buffer.from(result.data.stdout, 'base64').toString().trim() : '';
        const error = result.data.stderr ? 
          Buffer.from(result.data.stderr, 'base64').toString() : '';
        const compileOutput = result.data.compile_output ?
          Buffer.from(result.data.compile_output, 'base64').toString() : '';
        
        let status = 'failed';
        let errorMessage = '';
        
        // Determine test result status
        if (result.data.status.id === 3) { // Accepted
          if (testCase.expected) {
            status = output === testCase.expected.trim() ? 'passed' : 'failed';
          } else {
            status = 'passed'; // No expected output to compare
          }
        } else if (result.data.status.id === 4) { // Wrong Answer
          status = 'failed';
        } else if (result.data.status.id === 5) { // Time Limit Exceeded
          status = 'timeout';
          errorMessage = 'Time limit exceeded';
        } else if (result.data.status.id === 6) { // Compilation Error
          status = 'error';
          errorMessage = compileOutput || 'Compilation error';
        } else if (result.data.status.id >= 7) { // Runtime Error and others
          status = 'error';
          errorMessage = error || result.data.status.description;
        }
        
        results.push({
          input: testCase.input || '',
          expectedOutput: testCase.expected || '',
          actualOutput: output,
          status: status,
          executionTime: result.data.time ? parseFloat(result.data.time) * 1000 : 0,
          memory: result.data.memory || 0,
          errorMessage: errorMessage
        });

      } catch (error) {
        console.error(`❌ Test case ${i + 1} failed:`, error.message);
        results.push({
          input: testCase.input || '',
          expectedOutput: testCase.expected || '',
          actualOutput: '',
          status: 'error',
          executionTime: 0,
          memory: 0,
          errorMessage: error.message
        });
      }
    }

    return results;
  }

  // Get supported languages
  getSupportedLanguages() {
    return Object.keys(this.languageIds).map(lang => ({
      id: lang,
      name: this.getLanguageDisplayName(lang),
      judge0Id: this.languageIds[lang]
    }));
  }

  getLanguageDisplayName(lang) {
    const names = {
      javascript: 'JavaScript (Node.js)',
      python: 'Python 3',
      cpp: 'C++',
      c: 'C',
      java: 'Java',
      csharp: 'C#',
      go: 'Go',
      rust: 'Rust',
      php: 'PHP',
      ruby: 'Ruby'
    };
    return names[lang] || lang;
  }
}

module.exports = new Judge0Service();