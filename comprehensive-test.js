// comprehensive-test.js - Comprehensive Piston Backend Test
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/code-exec';

// Helper function to pretty print results
function printResult(title, result) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);
  console.log(JSON.stringify(result, null, 2));
}

// Test data for each language
const testCases = {
  python: {
    simpleCode: `
# Simple Python test
def greet(name):
    return f"Hello, {name}!"

print(greet("Python"))
print("Numbers:", 1 + 2 + 3)
print("List:", [x*2 for x in range(5)])
`.trim(),

    algorithmCode: `
# Reverse a number algorithm
def reverse_number(num):
    result = 0
    while num > 0:
        result = result * 10 + num % 10
        num //= 10
    return result

# Test with inputs
import sys
input_num = int(input())
print(reverse_number(input_num))
`.trim(),

    testCases: [
      { input: "1234", expected: "4321" },
      { input: "5678", expected: "8765" },
      { input: "100", expected: "1" }
    ]
  },

  javascript: {
    simpleCode: `
// Simple JavaScript test
function greet(name) {
    return \`Hello, \${name}!\`;
}

console.log(greet("JavaScript"));
console.log("Numbers:", 1 + 2 + 3);
console.log("Array:", [1,2,3,4].map(x => x * 2));
console.log("Current time:", new Date().toISOString());
`.trim(),

    algorithmCode: `
// Reverse a number algorithm
function reverseNumber(num) {
    let result = 0;
    while (num > 0) {
        result = result * 10 + (num % 10);
        num = Math.floor(num / 10);
    }
    return result;
}

// Read from stdin and process
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    const num = parseInt(input.trim());
    console.log(reverseNumber(num));
    rl.close();
});
`.trim(),

    testCases: [
      { input: "1234", expected: "4321" },
      { input: "5678", expected: "8765" },
      { input: "100", expected: "1" }
    ]
  },

  java: {
    simpleCode: `
// Simple Java test
import java.util.*;

public class Solution {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
        System.out.println("Numbers: " + (1 + 2 + 3));
        
        List<Integer> numbers = Arrays.asList(1, 2, 3, 4);
        System.out.print("Array doubled: [");
        for (int i = 0; i < numbers.size(); i++) {
            System.out.print(numbers.get(i) * 2);
            if (i < numbers.size() - 1) System.out.print(", ");
        }
        System.out.println("]");
        
        System.out.println("Random: " + Math.random());
    }
}
`.trim(),

    algorithmCode: `
// Reverse a number algorithm
import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int num = scanner.nextInt();
        System.out.println(reverseNumber(num));
        scanner.close();
    }
    
    public static int reverseNumber(int num) {
        int result = 0;
        while (num > 0) {
            result = result * 10 + num % 10;
            num /= 10;
        }
        return result;
    }
}
`.trim(),

    testCases: [
      { input: "1234", expected: "4321" },
      { input: "5678", expected: "8765" },
      { input: "100", expected: "1" }
    ]
  }
};

async function testSimpleExecution() {
  console.log('\n🧪 Testing Simple Code Execution');
  console.log('==================================');

  for (const [language, data] of Object.entries(testCases)) {
    try {
      console.log(`\n📝 Testing ${language.toUpperCase()}...`);
      
      const response = await axios.post(`${BASE_URL}/test`, {
        language: language,
        code: data.simpleCode
      });

      const result = response.data.data;
      
      console.log(`✅ Success: ${result.success}`);
      console.log(`📤 Output: ${result.output || '(no output)'}`);
      console.log(`❌ Error: ${result.error || '(no error)'}`);
      console.log(`⏱️ Execution Time: ${result.executionTime}ms`);

    } catch (error) {
      console.log(`❌ ${language} test failed:`, error.response?.data || error.message);
    }
  }
}

async function testWithInput() {
  console.log('\n\n🔄 Testing Code with Custom Input');
  console.log('=================================');

  for (const [language, data] of Object.entries(testCases)) {
    try {
      console.log(`\n📝 Testing ${language.toUpperCase()} with input "42"...`);
      
      const response = await axios.post(`${BASE_URL}/test`, {
        language: language,
        code: data.algorithmCode,
        input: "42"
      });

      const result = response.data.data;
      
      console.log(`✅ Success: ${result.success}`);
      console.log(`📤 Output: ${result.output || '(no output)'}`);
      console.log(`❌ Error: ${result.error || '(no error)'}`);
      console.log(`⏱️ Execution Time: ${result.executionTime}ms`);

    } catch (error) {
      console.log(`❌ ${language} input test failed:`, error.response?.data || error.message);
    }
  }
}

async function testWithTestCases() {
  console.log('\n\n🎯 Testing Code with Test Cases (Full Submission)');
  console.log('=================================================');

  for (const [language, data] of Object.entries(testCases)) {
    try {
      console.log(`\n📝 Testing ${language.toUpperCase()} with test cases...`);
      
      const response = await axios.post(`${BASE_URL}/run`, {
        language: language,
        code: data.algorithmCode,
        testCases: data.testCases
      });

      const result = response.data.data;
      
      printResult(`${language} Submission Results`, result);

      console.log(`\n📊 Summary:`);
      console.log(`   Score: ${result.score}%`);
      console.log(`   Passed: ${result.passedTestCases}/${result.totalTestCases}`);
      
      result.testResults.forEach((test, index) => {
        console.log(`   Test ${test.testCase}: ${test.passed ? '✅ PASS' : '❌ FAIL'}`);
        if (!test.passed) {
          console.log(`     Expected: ${test.expectedOutput}`);
          console.log(`     Got: ${test.actualOutput}`);
          if (test.error) console.log(`     Error: ${test.error}`);
        }
      });

    } catch (error) {
      console.log(`❌ ${language} test case execution failed:`, error.response?.data || error.message);
    }
  }
}

async function testErrorHandling() {
  console.log('\n\n💥 Testing Error Handling');
  console.log('=========================');

  const errorTests = [
    {
      name: 'Syntax Error (Python)',
      language: 'python',
      code: 'print("Hello World"'  // Missing closing parenthesis
    },
    {
      name: 'Runtime Error (Java)',
      language: 'java',  
      code: `
public class Solution {
    public static void main(String[] args) {
        int[] arr = {1, 2, 3};
        System.out.println(arr[10]); // Array index out of bounds
    }
}
`.trim()
    },
    {
      name: 'Compilation Error (C++)',
      language: 'cpp',
      code: '#include <iostream>\nint main() { std::cout << "missing semicolon" }'  // Missing semicolon
    }
  ];

  for (const test of errorTests) {
    try {
      console.log(`\n📝 Testing: ${test.name}`);
      
      const response = await axios.post(`${BASE_URL}/test`, {
        language: test.language,
        code: test.code
      });

      const result = response.data.data;
      
      console.log(`✅ Success: ${result.success}`);
      console.log(`📤 Output: ${result.output || '(no output)'}`);
      console.log(`❌ Error: ${result.error || '(no error)'}`);

    } catch (error) {
      console.log(`❌ Test failed:`, error.response?.data || error.message);
    }
  }
}

async function testHealthAndLanguages() {
  console.log('\n\n🏥 Testing Health and Language Support');
  console.log('=====================================');

  try {
    // Health check
    const health = await axios.get(`${BASE_URL}/health`);
    printResult('Health Check', health.data.data);

    // Available languages
    const languages = await axios.get(`${BASE_URL}/languages`);
    printResult('Supported Languages', languages.data.data);

  } catch (error) {
    console.log(`❌ Health/Languages test failed:`, error.response?.data || error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Comprehensive Piston Backend Tests');
  console.log('===============================================');
  
  try {
    await testHealthAndLanguages();
    await testSimpleExecution();
    await testWithInput();
    await testWithTestCases();
    await testErrorHandling();
    
    console.log('\n\n🎉 All tests completed!');
    console.log('Check the results above to verify everything is working correctly.');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

// Run all tests
runAllTests();