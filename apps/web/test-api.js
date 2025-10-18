// Test script for Leo API endpoints
const https = require('https');

// Disable SSL verification for self-signed cert
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function testGet() {
  return new Promise((resolve, reject) => {
    https.get('https://localhost:3000/api/pig/testpig', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('\n📥 GET /api/pig/testpig');
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
        resolve(JSON.parse(data));
      });
    }).on('error', reject);
  });
}

function testPost() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ pigId: 'testpig', name: 'Gulabo' });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/pig/name',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('\n📤 POST /api/pig/name');
        console.log('Status:', res.statusCode);
        console.log('Body:', JSON.stringify({ pigId: 'testpig', name: 'Gulabo' }));
        console.log('Response:', data);
        resolve(JSON.parse(data));
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  try {
    console.log('🐷 Testing Leo API endpoints...\n');
    
    // Test 1: GET before naming
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 1: Check if pig is named');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const result1 = await testGet();
    
    // Test 2: POST to name the pig
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 2: Name the pig "Gulabo"');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const result2 = await testPost();
    
    // Test 3: GET after naming
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 3: Verify pig remembers name');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const result3 = await testGet();
    
    console.log('\n✅ All tests completed!');
    console.log('\n📊 Summary:');
    console.log('  Before naming:', JSON.stringify(result1));
    console.log('  After naming: ', JSON.stringify(result3));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests();
