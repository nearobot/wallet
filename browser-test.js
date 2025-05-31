// Copy and paste this in your browser console (F12)
// Make sure you're on the wallet page with a connected wallet

// Test sending a transaction request
const testTransaction = () => {
  // This simulates a transaction request from your bot
  const transactionData = {
    type: 'process_transaction',
    transactionId: 'test-tx-' + Date.now(),
    transactionData: {
      receiverId: 'textroyale.testnet',
      methodName: 'test_game_action',
      args: {
        action: 'move',
        direction: 'north',
        player: 'TestPlayer'
      },
      gas: '30000000000000',
      deposit: '1000000000000000000000000' // 1 NEAR
    },
    timestamp: new Date().toISOString()
  };
  
  console.log('Simulating transaction request:', transactionData);
  
  // Trigger the transaction approval UI
  // (This would normally come from WebSocket)
  window.dispatchEvent(new CustomEvent('test-transaction', { 
    detail: transactionData 
  }));
};

// Test different transaction types
const testFunctionCall = () => {
  testTransaction();
};

const testTokenTransfer = () => {
  const transferData = {
    type: 'process_transaction',
    transactionId: 'transfer-tx-' + Date.now(),
    transactionData: {
      receiverId: 'token.testnet',
      methodName: 'ft_transfer',
      args: {
        receiver_id: 'recipient.testnet',
        amount: '1000000000000000000000000'
      },
      gas: '30000000000000',
      deposit: '1'
    }
  };
  
  console.log('Testing token transfer:', transferData);
};

// Run tests
console.log('🧪 Transaction testing utilities loaded!');
console.log('Use testFunctionCall() or testTokenTransfer() to test');

// Auto-test after 2 seconds
setTimeout(() => {
  console.log('🚀 Auto-testing transaction...');
  testFunctionCall();
}, 2000); 