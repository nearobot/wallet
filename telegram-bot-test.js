const axios = require('axios');

// Your frontend URL
const FRONTEND_URL = 'http://localhost:3000';

// Test function to get wallet URL by session ID
async function getWalletUrl(sessionId) {
  try {
    console.log(`🤖 Bot getting wallet URL for session: ${sessionId}`);
    
    // Simple GET request with just sessionId
    const getUrl = `${FRONTEND_URL}/api/send/?sessionid=${sessionId}`;
    
    console.log('📡 GET Request:', getUrl);
    
    const response = await axios.get(getUrl);
    
    console.log('✅ Wallet URL retrieved successfully!');
    console.log('Response:', response.data);
    console.log('🔗 Wallet URL:', response.data.walletUrl);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Error getting wallet URL:', error.response?.data || error.message);
    return null;
  }
}

// Test function using POST request
async function getWalletUrlPOST(sessionId) {
  try {
    console.log(`🤖 Bot getting wallet URL (POST) for session: ${sessionId}`);
    
    const postData = {
      sessionId
    };
    
    console.log('📡 POST Data:', postData);
    
    const response = await axios.post(`${FRONTEND_URL}/api/send/`, postData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Wallet URL retrieved successfully!');
    console.log('Response:', response.data);
    console.log('🔗 Wallet URL:', response.data.walletUrl);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Error getting wallet URL:', error.response?.data || error.message);
    return null;
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Simplified Telegram Bot API Tests\n');
  
  // Test with example session IDs
  // In real usage, your bot would create these sessions first via WebSocket
  const testSessionIds = [
    'test-session-123',
    'game-session-456',
    'payment-session-789'
  ];
  
  console.log('📝 Testing with session IDs:', testSessionIds);
  
  for (const sessionId of testSessionIds) {
    console.log(`\n--- Testing Session: ${sessionId} ---`);
    
    // Test GET request
    console.log('🔄 GET method:');
    const result1 = await getWalletUrl(sessionId);
    
    if (result1) {
      console.log('💡 User should visit:', result1.walletUrl);
      if (result1.transactionData) {
        console.log('💰 Transaction found:', {
          amount: result1.transactionData.amount,
          receiver: result1.transactionData.receiver,
          purpose: result1.transactionData.purpose
        });
      }
    }
    
    // Test POST request
    console.log('\n🔄 POST method:');
    const result2 = await getWalletUrlPOST(sessionId);
    
    if (result2) {
      console.log('💡 User should visit:', result2.walletUrl);
    }
    
    console.log('\n' + '─'.repeat(50));
  }
}

// Error handling test
async function testErrorCases() {
  console.log('\n🔍 Testing error cases...');
  
  // Missing sessionId
  try {
    const response = await axios.get(`${FRONTEND_URL}/api/send/`);
  } catch (error) {
    console.log('✅ Missing sessionId error handled:', error.response?.data?.error);
  }
  
  // Invalid/non-existent sessionId
  try {
    const response = await axios.get(`${FRONTEND_URL}/api/send/?sessionid=non-existent-session`);
  } catch (error) {
    console.log('✅ Non-existent session error handled:', error.response?.data?.error);
  }
  
  // Empty sessionId
  try {
    const response = await axios.get(`${FRONTEND_URL}/api/send/?sessionid=`);
  } catch (error) {
    console.log('✅ Empty sessionId error handled:', error.response?.data?.error);
  }
}

// Example of how bot would use this in practice
function showBotExample() {
  console.log('\n📚 Bot Usage Example:');
  console.log('━'.repeat(60));
  console.log('// 1. Bot creates session with transaction data via WebSocket');
  console.log('ws.send(JSON.stringify({');
  console.log('  type: "create_session",');
  console.log('  sessionId: "unique-session-id",');
  console.log('  userId: "telegram-user-123",');
  console.log('  chatId: "telegram-chat-456",');
  console.log('  username: "PlayerName",');
  console.log('  transactionData: {');
  console.log('    amount: "5500000000000000000000000", // 5.5 NEAR in yocto');
  console.log('    receiver: "textroyale.testnet",');
  console.log('    purpose: "game purchase",');
  console.log('    method: "transfer"');
  console.log('  }');
  console.log('}));');
  console.log('');
  console.log('// 2. Bot gets wallet URL using only sessionId');
  console.log('const response = await fetch(`/api/send/?sessionid=${sessionId}`);');
  console.log('const { walletUrl } = await response.json();');
  console.log('');
  console.log('// 3. Bot sends wallet URL to user');
  console.log('bot.sendMessage(chatId, `Visit: ${walletUrl}`);');
  console.log('━'.repeat(60));
}

// Run all tests
(async () => {
  showBotExample();
  await runTests();
  await testErrorCases();
  
  console.log('\n✨ All tests completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Start your WebSocket server: node your-websocket-server.js');
  console.log('2. Create sessions with transaction data via WebSocket');
  console.log('3. Start your frontend: npm run dev');
  console.log('4. Use API with just sessionId: /api/send/?sessionid=YOUR_SESSION_ID');
  console.log('5. Frontend will auto-fetch transaction data and process payment');
})(); 