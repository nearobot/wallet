const WebSocket = require('ws');

// Connect to your WebSocket server
const ws = new WebSocket('ws://localhost:3001');

ws.on('open', function open() {
  console.log('Connected to WebSocket server');
  
  // Step 1: Connect as bot
  ws.send(JSON.stringify({
    type: 'bot_connect'
  }));
  
  // Step 2: Create a session (simulate Telegram bot)
  setTimeout(() => {
    ws.send(JSON.stringify({
      type: 'create_session',
      sessionId: 'test-session-123',
      userId: 'test-user-456',
      chatId: 'test-chat-789',
      username: 'TestPlayer'
    }));
  }, 1000);
  
  // Step 3: Send a transaction for signing (after wallet is connected)
  setTimeout(() => {
    console.log('Sending transaction request...');
    ws.send(JSON.stringify({
      type: 'process_transaction',
      sessionId: 'test-session-123',
      transactionId: 'tx-' + Date.now(),
      transactionData: {
        receiverId: 'textroyale.testnet',
        methodName: 'test_method',
        args: {
          message: 'Hello from test!'
        },
        gas: '30000000000000',
        deposit: '0'
      }
    }));
  }, 5000); // Wait 5 seconds for wallet connection
});

ws.on('message', function message(data) {
  const msg = JSON.parse(data);
  console.log('Received:', msg);
  
  if (msg.type === 'wallet_connected') {
    console.log('✅ Wallet connected:', msg.walletId);
  }
  
  if (msg.type === 'transaction_completed') {
    console.log('✅ Transaction completed:', msg);
  }
});

ws.on('close', function close() {
  console.log('Disconnected from server');
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
}); 