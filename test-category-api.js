// test-category-api.js - Test script to verify category API
// Run with: node test-category-api.js

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testCategoryAPI() {
  console.log('🧪 Testing Category API...\n');

  const tests = [
    {
      name: 'GET /api/categories',
      method: 'GET',
      url: `${BASE_URL}/api/categories`
    },
    {
      name: 'GET /api/categories/tree',
      method: 'GET', 
      url: `${BASE_URL}/api/categories/tree`
    },
    {
      name: 'GET /api/categories/flat',
      method: 'GET',
      url: `${BASE_URL}/api/categories/flat`
    },
    {
      name: 'GET /api/categories/level',
      method: 'GET',
      url: `${BASE_URL}/api/categories/level?level=0`
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\n📡 Testing: ${test.name}`);
      console.log(`   URL: ${test.url}`);
      
      const response = await axios({
        method: test.method,
        url: test.url,
        timeout: 5000
      });

      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   ✅ Success: ${response.data.success}`);
      console.log(`   ✅ Data count: ${response.data.data?.length || 0}`);
      console.log(`   ✅ Message: ${response.data.message || 'No message'}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.response?.status || 'Network Error'}`);
      console.log(`   ❌ Message: ${error.response?.data?.message || error.message}`);
    }
  }

  console.log('\n🏁 Test completed!');
  console.log('\n💡 If all tests pass, your frontend should work correctly.');
}

// Test server connectivity first
async function checkServer() {
  try {
    console.log('🔍 Checking server connectivity...');
    const response = await axios.get(`${BASE_URL}/test`, { timeout: 3000 });
    console.log('✅ Server is running and responsive\n');
    return true;
  } catch (error) {
    console.log('❌ Server is not running or not responsive');
    console.log('   Make sure your server is running on port 5000');
    console.log('   Try: npm start or node debug-server.js\n');
    return false;
  }
}

// Main execution
async function main() {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await testCategoryAPI();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testCategoryAPI, checkServer };