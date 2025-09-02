// services/hackerEarthService.js
const axios = require('axios');

class HackerEarthService {
  constructor() {
    this.baseURL = 'https://api.hackerearth.com/v4';
    this.clientSecret = process.env.HACKEREARTH_CLIENT_SECRET;
    
    // HackerEarth Language Support (40+ languages)
    this.languages = {
      // Popular languages
      'JAVASCRIPT_NODE': { name: 'JavaScript (Node.js)', extension: 'js' },
      'PYTHON3': { name: 'Python 3', extension: 'py' },
      'CPP17': { name: 'C++ 17', extension: 'cpp' },
      'CPP14': { name: 'C++ 14', extension: 'cpp' },
      'C': { name: 'C', extension: 'c' },
      'JAVA14': { name: 'Java 14', extension: 'java' },
      'JAVA8': { name: 'Java 8', extension: 'java' },
      'CSHARP': { name: 'C#', extension: 'cs' },
      'GO': { name: 'Go', extension: 'go' },
      'RUST': { name: 'Rust', extension: 'rs' },
      'KOTLIN': { name: 'Kotlin', extension: 'kt' },
      'SWIFT': { name: 'Swift', extension: 'swift' },
      'TYPESCRIPT': { name: 'TypeScript', extension: 'ts' },
      
      // Scripting languages
      'PYTHON2': { name: 'Python 2', extension: 'py' },
      'RUBY': { name: 'Ruby', extension: 'rb' },
      'PHP': { name: 'PHP', extension: 'php' },
      'PERL': { name: 'Perl', extension: 'pl' },
      'LUA': { name: 'Lua', extension: 'lua' },
      'BASH': { name: 'Bash', extension: 'sh' },
      
      // Functional languages
      'HASKELL': { name: 'Haskell', extension: 'hs' },
      'SCALA': { name: 'Scala', extension: 'scala' },
      'CLOJURE': { name: 'Clojure', extension: 'clj' },
      'ERLANG': { name: 'Erlang', extension: 'erl' },
      'ELIXIR': { name: 'Elixir', extension: 'ex' },
      
      // Other languages
      'R': { name: 'R', extension: 'r' },
      'MATLAB': { name: 'MATLAB', extension: 'm' },
      'FORTRAN': { name: 'Fortran', extension: 'f90' },
      'COBOL': { name: 'COBOL', extension: 'cbl' },
      'DART': { name: 'Dart', extension: 'dart' },
      'VB': { name: 'Visual Basic', extension: 'vb' }
    };
  }

  /**
   * Execute code with test cases using HackerEarth API V4
   * @param {string} code - Source code to execute
   * @param {string} language - Programming language (e.g., 'PYTHON3', 'CPP17')
   * @param {Array} testCases - Array of test cases with input and expected output
   * @param {Object} options - Execution options (time_limit, memory_limit)
   * @returns {Promise<Object>} Execution results
   */
  async executeCode(code, language, testCases, options = {}) {
    try {
      const results = [];
      
      // Execute each test case
      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        
        const payload = {
          lang: language.toUpperCase(),
          source: code,
          input: testCase.input || '',
          memory_limit: options.memoryLimit || 262144, // 256 MB default
          time_limit: options.timeLimit || 5, // 5 seconds default
          context: `test_case_${i + 1}`,
          callback: options.callback || ''
        };

        const response = await axios.post(`${this.baseURL}/code/compile/`, payload, {
          headers: {
            'client-secret': this.clientSecret,
            'Content-Type': 'application/json'
          }
        });

        const result = response.data;
        
        // Parse the result
        const testResult = {
          input: testCase.input,
          expectedOutput: testCase.expected.trim(),
          actualOutput: (result.run_status?.output || '').trim(),
          status: this.getTestStatus(result, testCase.expected.trim()),
          executionTime: result.run_status?.time_used || 0,
          memory: result.run_status?.memory_used || 0,
          compilationStatus: result.compile_status,
          runStatus: result.run_status?.status,
          error: result.compile_status !== 'OK' ? result.compile_status : 
                 (result.run_status?.stderr || ''),
          weight: testCase.weight || 1
        };

        results.push(testResult);
      }

      return this.calculateOverallResult(results);
      
    } catch (error) {
      console.error('HackerEarth API Error:', error.response?.data || error.message);
      throw new Error(`Code execution failed: ${error.message}`);
    }
  }

  /**
   * Determine if test case passed
   */
  getTestStatus(result, expectedOutput) {
    // Check compilation first
    if (result.compile_status !== 'OK') {
      return 'compilation_error';
    }

    // Check runtime status
    if (result.run_status?.status !== 'AC') { // AC = Accepted
      switch (result.run_status?.status) {
        case 'TLE': return 'time_limit_exceeded';
        case 'MLE': return 'memory_limit_exceeded';
        case 'RE': return 'runtime_error';
        case 'WA': return 'wrong_answer';
        default: return 'error';
      }
    }

    // Compare outputs
    const actualOutput = (result.run_status?.output || '').trim();
    const expected = expectedOutput.trim();
    
    return actualOutput === expected ? 'passed' : 'wrong_answer';
  }

  /**
   * Calculate overall execution result
   */
  calculateOverallResult(testResults) {
    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.status === 'passed').length;
    const totalWeight = testResults.reduce((sum, r) => sum + r.weight, 0);
    const passedWeight = testResults
      .filter(r => r.status === 'passed')
      .reduce((sum, r) => sum + r.weight, 0);

    // Calculate weighted score
    const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;
    
    // Determine overall status
    let overallStatus = 'completed';
    if (testResults.some(r => r.status === 'compilation_error')) {
      overallStatus = 'compilation_error';
    } else if (testResults.some(r => r.status.includes('error'))) {
      overallStatus = 'runtime_error';
    } else if (passedTests === totalTests) {
      overallStatus = 'all_passed';
    } else if (passedTests > 0) {
      overallStatus = 'partial_passed';
    } else {
      overallStatus = 'all_failed';
    }

    return {
      testResults,
      summary: {
        totalTestCases: totalTests,
        passedTestCases: passedTests,
        failedTestCases: totalTests - passedTests,
        score: score,
        status: overallStatus,
        totalExecutionTime: testResults.reduce((sum, r) => sum + r.executionTime, 0),
        maxMemoryUsed: Math.max(...testResults.map(r => r.memory)),
        averageExecutionTime: testResults.reduce((sum, r) => sum + r.executionTime, 0) / totalTests
      }
    };
  }

  /**
   * Get supported languages list
   */
  getSupportedLanguages() {
    return Object.entries(this.languages).map(([key, value]) => ({
      id: key,
      name: value.name,
      extension: value.extension
    }));
  }

  /**
   * Validate language support
   */
  isLanguageSupported(language) {
    return this.languages.hasOwnProperty(language.toUpperCase());
  }

  /**
   * Get starter code template for a language
   */
  getStarterTemplate(language, problemType = 'function') {
    const templates = {
      'PYTHON3': {
        function: `def solution():
    # Write your code here
    return result

# Test your function
print(solution())`,
        input: `# Read input
n = int(input())

# Write your solution here

# Print output
print(result)`
      },
      'JAVASCRIPT_NODE': {
        function: `function solution() {
    // Write your code here
    return result;
}

// Test your function
console.log(solution());`,
        input: `// Read input using readline
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    // Process input here
    const n = parseInt(input);
    
    // Write your solution here
    
    // Print output
    console.log(result);
    rl.close();
});`
      },
      'CPP17': {
        function: `#include<iostream>
using namespace std;

int solution() {
    // Write your code here
    return result;
}

int main() {
    cout << solution() << endl;
    return 0;
}`,
        input: `#include<iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    
    // Write your solution here
    
    cout << result << endl;
    return 0;
}`
      },
      'JAVA14': {
        function: `public class Solution {
    public static int solution() {
        // Write your code here
        return result;
    }
    
    public static void main(String[] args) {
        System.out.println(solution());
    }
}`,
        input: `import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        
        // Write your solution here
        
        System.out.println(result);
        sc.close();
    }
}`
      }
    };

    const lang = language.toUpperCase();
    return templates[lang] ? templates[lang][problemType] : 
           `// Starter code for ${this.languages[lang]?.name || language}`;
  }

  /**
   * Advanced: Async execution with webhook (for long-running tests)
   */
  async executeCodeAsync(code, language, testCases, callbackUrl, options = {}) {
    try {
      const payload = {
        lang: language.toUpperCase(),
        source: code,
        input: testCases.map(tc => tc.input).join('\n---\n'),
        memory_limit: options.memoryLimit || 262144,
        time_limit: options.timeLimit || 10,
        callback: callbackUrl,
        context: options.context || 'async_execution'
      };

      const response = await axios.post(`${this.baseURL}/code/compile/`, payload, {
        headers: {
          'client-secret': this.clientSecret,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        executionId: response.data.he_id || response.data.request_id,
        status: 'queued',
        message: 'Code execution queued. Results will be sent to callback URL.'
      };

    } catch (error) {
      throw new Error(`Async execution failed: ${error.message}`);
    }
  }
}

module.exports = HackerEarthService;