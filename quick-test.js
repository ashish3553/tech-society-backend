// quick-test.js - Simple test with correct timeouts
const axios = require('axios');

async function quickTest() {
  try {
    console.log('Testing with reduced timeout...');
    
    // Test direct backend call
    const response = await axios.post('http://localhost:5000/api/code-exec/test', {
      language: 'python',
      code: 'print("Hello World!")\nprint("Math:", 2 + 3)'
    });

    console.log('Backend Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

quickTest();