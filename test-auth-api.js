const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

async function testAuth() {
  console.log('🔍 Testing SYNTHEX Authentication System...\n');
  
  try {
    // Test 1: Register a new user
    console.log('1️⃣ Testing User Registration...');
    const registerData = {
      email: 'test@synthex.dev',
      password: 'Test@123456',
      name: 'Test User'
    };
    
    try {
      const registerResponse = await axios.post(`${API_BASE_URL}/auth/register`, registerData);
      console.log('✅ Registration successful:', registerResponse.data.message);
      console.log('   Token received:', registerResponse.data.token ? 'Yes' : 'No');
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('⚠️  User already exists, proceeding with login...');
      } else {
        console.log('❌ Registration failed:', error.response?.data || error.message);
      }
    }
    
    // Test 2: Login
    console.log('\n2️⃣ Testing User Login...');
    const loginData = {
      email: 'test@synthex.dev',
      password: 'Test@123456'
    };
    
    let token;
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, loginData);
      console.log('✅ Login successful:', loginResponse.data.message);
      token = loginResponse.data.token;
      console.log('   Token received:', token ? 'Yes' : 'No');
    } catch (error) {
      console.log('❌ Login failed:', error.response?.data || error.message);
      return;
    }
    
    // Test 3: Verify token
    console.log('\n3️⃣ Testing Token Verification...');
    try {
      const verifyResponse = await axios.get(`${API_BASE_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Token valid:', verifyResponse.data.valid);
      console.log('   User:', verifyResponse.data.user?.email);
    } catch (error) {
      console.log('❌ Token verification failed:', error.response?.data || error.message);
    }
    
    // Test 4: Get profile
    console.log('\n4️⃣ Testing Profile Retrieval...');
    try {
      const profileResponse = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Profile retrieved successfully');
      console.log('   User:', profileResponse.data.user);
    } catch (error) {
      console.log('❌ Profile retrieval failed:', error.response?.data || error.message);
    }
    
    console.log('\n✨ Authentication system test complete!');
    
  } catch (error) {
    console.error('🔥 Test failed with error:', error.message);
  }
}

// Run the test
testAuth();