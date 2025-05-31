"use client"

import { useState, useEffect, useRef } from "react"
import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core"
import { setupHotWallet } from "@near-wallet-selector/hot-wallet"
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet"
import { setupIntearWallet } from "@near-wallet-selector/intear-wallet"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Separator } from "../components/ui/separator"
import { Wallet, LogOut, User, Globe, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "../components/ui/alert"

interface Account {
  accountId: string
}

// WebSocket hook for Text Royale integration
const useTextRoyaleWebSocket = () => {
  const [wsStatus, setWsStatus] = useState('connecting') // connecting, connected, error, success
  const [wsMessage, setWsMessage] = useState('Initializing connection...')
  const [sessionInfo, setSessionInfo] = useState<{userId: string, username: string} | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [pendingTransaction, setPendingTransaction] = useState<any>(null)
  const [isProcessingTransaction, setIsProcessingTransaction] = useState(false)
  const [transactionMetadata, setTransactionMetadata] = useState<any>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const retryAttemptsRef = useRef(0)
  const maxRetries = 3

  // Get session ID and transaction params from URL
  const getUrlParams = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return {
        sessionId: urlParams.get('sessionId'),
        amount: urlParams.get('amount'),
        receiver: urlParams.get('receiver'),
        purpose: urlParams.get('purpose')
      }
    }
    return { sessionId: null, amount: null, receiver: null, purpose: null }
  }

  // Fetch transaction data from WebSocket server
  const fetchTransactionData = async (sessionId: string) => {
    try {
      console.log('Fetching transaction data for session:', sessionId)
      const response = await fetch(`https://wallet-rosy-theta.vercel.app/session/${sessionId}/transaction`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Transaction data fetched:', data)
        setTransactionMetadata(data.transactionData)
        return data.transactionData
      } else {
        console.log('No transaction data found for session')
        return null
      }
    } catch (error) {
      console.error('Error fetching transaction data:', error)
      return null
    }
  }

  // Auto-trigger transaction when wallet connects and transaction data exists
  const autoTriggerTransaction = async () => {
    if (!transactionMetadata || !sessionIdRef.current) {
      return
    }

    const txData = {
      receiverId: transactionMetadata.receiver,
      methodName: transactionMetadata.method === 'transfer' ? 'ft_transfer' : 'transfer',
      args: transactionMetadata.method === 'transfer' ? {
        receiver_id: transactionMetadata.receiver,
        amount: transactionMetadata.amount,
        memo: transactionMetadata.purpose || 'Text Royale payment'
      } : {},
      gas: '30000000000000',
      deposit: transactionMetadata.method === 'transfer' ? '1' : transactionMetadata.amount
    }

    console.log('Auto-triggering transaction:', txData)
    
    // Create a pending transaction
    setPendingTransaction({
      transactionId: 'auto-' + Date.now(),
      transactionData: txData,
      metadata: transactionMetadata
    })
  }

  // Initialize WebSocket connection
  const initializeConnection = () => {
    try {
      // Update this URL to point to your WebSocket server
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'https://ws.textroyale.com/'
      
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        console.log('WebSocket connection established')
        setWsStatus('connected')
        retryAttemptsRef.current = 0

        // Initialize session with the session ID from URL
        if (sessionIdRef.current && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'init_session',
            sessionId: sessionIdRef.current
          }))
        }
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleWebSocketMessage(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
          setWsMessage('Invalid message received from server')
          setWsStatus('error')
        }
      }

      wsRef.current.onclose = () => {
        console.log('WebSocket connection closed')
        setWsStatus('connecting')
        attemptReconnect()
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setWsMessage('Connection error. Please try again.')
        setWsStatus('error')
      }

    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error)
      setWsMessage('Failed to connect. Please refresh and try again.')
      setWsStatus('error')
    }
  }

  // Handle WebSocket messages
  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'session_initialized':
        console.log('Session initialized for user:', message.username)
        setSessionInfo({
          userId: message.userId,
          username: message.username
        })
        setWsMessage(`Welcome ${message.username}! Please connect your NEAR wallet.`)
        setWsStatus('connected')
        
        // Check for transaction data in the session
        if (message.transactionData) {
          console.log('Transaction data found in session:', message.transactionData)
          setTransactionMetadata(message.transactionData)
        }
        break

      case 'wallet_connection_received':
        setWsMessage('Wallet connected successfully!')
        setWsStatus('success')
        
        // Auto-trigger transaction if metadata exists
        if (transactionMetadata) {
          setTimeout(() => {
            autoTriggerTransaction()
          }, 1000)
        }
        break

      case 'process_transaction':
        console.log('Received transaction to process:', message)
        setPendingTransaction(message)
        setWsMessage('Transaction received. Please review and sign.')
        break

      case 'transaction_result_received':
        console.log('Transaction result confirmed by server')
        setIsProcessingTransaction(false)
        setPendingTransaction(null)
        setWsMessage('Transaction completed successfully!')
        break

      case 'error':
        setWsMessage(message.message)
        setWsStatus('error')
        setIsProcessingTransaction(false)
        break

      case 'pong':
        // Handle ping-pong for connection health
        break

      default:
        console.log('Unknown message type:', message.type)
    }
  }

  // Attempt to reconnect
  const attemptReconnect = () => {
    if (retryAttemptsRef.current >= maxRetries) {
      setWsMessage('Unable to connect. Please refresh the page.')
      setWsStatus('error')
      return
    }

    retryAttemptsRef.current += 1
    setWsMessage(`Reconnecting... (${retryAttemptsRef.current}/${maxRetries})`)
    setWsStatus('connecting')

    setTimeout(() => {
      initializeConnection()
    }, 2000 * retryAttemptsRef.current)
  }

  // Send wallet connection data
  const sendWalletData = async (walletAddress: string, transactionHash = '') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setWsMessage('Not connected to server. Please refresh and try again.')
      setWsStatus('error')
      return false
    }

    if (!sessionIdRef.current) {
      setWsMessage('No session found. Please start from Telegram bot.')
      setWsStatus('error')
      return false
    }

    try {
      setIsSending(true)
      setWsMessage('Sending wallet information to Telegram...')

      wsRef.current.send(JSON.stringify({
        type: 'wallet_connected',
        sessionId: sessionIdRef.current,
        walletId: walletAddress,
        txnLink: transactionHash
      }))

      return true
    } catch (error) {
      console.error('Error sending wallet connection:', error)
      setWsMessage('Failed to send wallet information.')
      setWsStatus('error')
      return false
    } finally {
      setIsSending(false)
    }
  }

  // Send transaction result back to server
  const sendTransactionResult = async (transactionId: string, success: boolean, signature?: string, txHash?: string, error?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected')
      return false
    }

    if (!sessionIdRef.current) {
      console.error('No session ID')
      return false
    }

    try {
      const resultData = {
        type: 'transaction_result',
        transactionId,
        success,
        sessionId: sessionIdRef.current,
        timestamp: new Date().toISOString(),
        ...(success && signature && { signature }),
        ...(success && txHash && { txHash }),
        ...(error && { error })
      }

      console.log('Sending transaction result:', resultData)
      wsRef.current.send(JSON.stringify(resultData))
      return true
    } catch (error) {
      console.error('Error sending transaction result:', error)
      return false
    }
  }

  // Initialize connection on mount
  useEffect(() => {
    // Get session ID and transaction params from URL
    const urlParams = getUrlParams()
    
    if (!urlParams.sessionId) {
      setWsMessage('No session ID found. Please start from Telegram bot.')
      setWsStatus('error')
      return
    }

    sessionIdRef.current = urlParams.sessionId
    setWsMessage('Connecting to Text Royale...')
    
    // If URL has transaction params, store them
    if (urlParams.amount && urlParams.receiver) {
      const metadata = {
        amount: (parseFloat(urlParams.amount) * 1e24).toString(), // Convert to yoctoNEAR
        receiver: urlParams.receiver,
        purpose: urlParams.purpose || 'payment',
        metadata: {
          originalAmount: urlParams.amount,
          currency: 'NEAR'
        }
      }
      setTransactionMetadata(metadata)
      console.log('Transaction metadata from URL:', metadata)
    }

    // Fetch transaction data from server
    fetchTransactionData(urlParams.sessionId)
    
    initializeConnection()

    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // Ping every 30 seconds

    // Cleanup on unmount
    return () => {
      clearInterval(pingInterval)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  return {
    wsStatus,
    wsMessage,
    sessionInfo,
    isSending,
    sendWalletData,
    pendingTransaction,
    isProcessingTransaction,
    setIsProcessingTransaction,
    sendTransactionResult,
    transactionMetadata,
    autoTriggerTransaction
  }
}

export default function WalletConnector() { 
  const [selector, setSelector] = useState<WalletSelector | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // WebSocket integration for Text Royale
  const {
    wsStatus,
    wsMessage,
    sessionInfo,
    isSending,
    sendWalletData,
    pendingTransaction,
    isProcessingTransaction,
    setIsProcessingTransaction,
    sendTransactionResult,
    transactionMetadata,
    autoTriggerTransaction
  } = useTextRoyaleWebSocket()

  // Check for session ID early
  const getSessionIdFromUrl = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('sessionId')
    }
    return null
  }

  const sessionId = getSessionIdFromUrl()

  useEffect(() => {
    const initWalletSelector = async () => {
      try {
        const walletSelector = await setupWalletSelector({
          network: "testnet",
          modules: [
            setupHotWallet(),
            setupMeteorWallet(),
            setupIntearWallet(),
          ],
        })

        setSelector(walletSelector)

        // Subscribe to wallet state changes
        const subscription = walletSelector.store.observable.subscribe((state) => {
          console.log("Wallet state changed:", state)
          if (state.accounts.length > 0) {
            const newAccount = { accountId: state.accounts[0].accountId }
            setAccount(newAccount)
            
            // Auto-send wallet data to Telegram when connected and WebSocket is ready
            if (wsStatus === 'connected' && !isSending) {
              handleSendToTelegram(newAccount.accountId)
            }
          } else {
            setAccount(null)
          }
        })

        // Check current state
        const currentState = walletSelector.store.getState()
        console.log("Current wallet state:", currentState)
        if (currentState.accounts.length > 0) {
          const currentAccount = { accountId: currentState.accounts[0].accountId }
          setAccount(currentAccount)
          
          // Auto-send if already connected and WebSocket is ready
          if (wsStatus === 'connected' && !isSending) {
            handleSendToTelegram(currentAccount.accountId)
          }
        }

        // Cleanup subscription on unmount
        return () => subscription.unsubscribe()
      } catch (err) {
        setError("Failed to initialize wallet selector")
        console.error("Wallet selector initialization error:", err)
      } finally {
        setIsLoading(false)
      }
    }

    initWalletSelector()
  }, [wsStatus, isSending])

  // Auto-send wallet data when both wallet and WebSocket are ready
  useEffect(() => {
    if (account && wsStatus === 'connected' && !isSending) {
      handleSendToTelegram(account.accountId)
    }
  }, [account, wsStatus, isSending])

  // Show overlay if no session ID - moved after all hooks
  if (!sessionId) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #dbeafe 0%, #c7d2fe 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
      >
        <Card style={{ 
          width: "100%", 
          maxWidth: "400px",
          textAlign: "center"
        }}>
          <CardContent style={{ padding: "48px 24px" }}>
            <div style={{
              marginBottom: "24px",
              fontSize: "48px"
            }}>
              🚫
            </div>
            <h2 style={{ 
              fontSize: "20px", 
              fontWeight: "600",
              marginBottom: "12px"
            }}>
              No Session ID Found
            </h2>
            <p style={{ 
              color: "#6b7280", 
              fontSize: "14px",
              lineHeight: "1.5"
            }}>
              Please start from wallet
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleConnect = async () => {
    if (!selector) {
      setError("Wallet selector not initialized")
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      console.log("Opening wallet selector...")

      // Get available wallets
      const wallets = selector.store.getState().modules
      console.log("Available wallets:", wallets.map(w => w.metadata.name))

      // Show wallet selection (you can implement a custom modal or use the first available wallet)
      // For now, let's try to connect to the first available wallet
      if (wallets.length === 0) {
        throw new Error("No wallets available")
      }

      // Try Hot wallet first, then Meteor, then Intear
      let selectedWallet = wallets.find(w => w.id === "hot-wallet") ||
                          wallets.find(w => w.id === "meteor-wallet") ||
                          wallets.find(w => w.id === "intear-wallet") ||
                          wallets[0]

      console.log("Selected wallet:", selectedWallet.metadata.name)

      const wallet = await selector.wallet(selectedWallet.id)
      console.log("Wallet instance:", wallet)

      // Sign in with the wallet
      const result = await wallet.signIn({
        contractId: "textroyale.testnet", // Updated for Text Royale
        methodNames: [],
        accounts: []
      })

      console.log("Sign in result:", result)

      // Get accounts after signing in
      const accounts = await wallet.getAccounts()
      console.log("Accounts:", accounts)

      if (accounts.length > 0) {
        const newAccount = { accountId: accounts[0].accountId }
        setAccount(newAccount)
        
        // Send to Telegram via WebSocket
        if (wsStatus === 'connected') {
          await handleSendToTelegram(newAccount.accountId)
        }
      } else {
        setError("No accounts found after connection")
      }
    } catch (err: any) {
      console.error("Wallet connection error:", err)
      setError(err.message || "Failed to connect wallet. Make sure you have a NEAR wallet installed.")
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSendToTelegram = async (accountId: string) => {
    if (wsStatus !== 'connected' || isSending) {
      return
    }

    try {
      // You can add transaction logic here if needed
      const transactionHash = '' // Add actual transaction hash if you perform a transaction
      
      console.log('Sending wallet data to Telegram:', accountId)
      const success = await sendWalletData(accountId, transactionHash)
      
      if (success) {
        console.log('Wallet data sent successfully to Telegram bot')
      }
    } catch (error) {
      console.error('Failed to send wallet data to Telegram:', error)
      setError('Failed to send wallet information to Telegram')
    }
  }

  const handleSignTransaction = async (transactionData: any) => {
    if (!selector || !account) {
      setError("Wallet not connected")
      return
    }

    if (!pendingTransaction) {
      setError("No pending transaction")
      return
    }

    setIsProcessingTransaction(true)
    setError(null)

    try {
      console.log("Processing transaction:", transactionData)
      
      // Get the connected wallet
      const state = selector.store.getState()
      if (!state.selectedWalletId) {
        throw new Error("No wallet selected")
      }

      const wallet = await selector.wallet(state.selectedWalletId)
      
      // Prepare transaction parameters
      const { receiverId, actions, gas, deposit } = transactionData

      console.log("Signing transaction with params:", {
        receiverId,
        actions: actions?.length || 0,
        gas,
        deposit
      })

      // Sign and send transaction
      const result = await wallet.signAndSendTransaction({
        receiverId: receiverId || "textroyale.testnet",
        actions: actions || [
          {
            type: "FunctionCall",
            params: {
              methodName: transactionData.methodName || "default_method",
              args: transactionData.args || {},
              gas: gas || "30000000000000",
              deposit: deposit || "0"
            }
          }
        ]
      })

      console.log("Transaction result:", result)

      // Extract transaction hash from result
      const txHash = typeof result === 'object' && result && 'transaction' in result 
        ? result.transaction?.hash 
        : undefined

      // Send success result back to WebSocket
      await sendTransactionResult(
        pendingTransaction.transactionId,
        true,
        txHash,
        txHash,
      )

      console.log("Transaction completed successfully")
      
    } catch (error: any) {
      console.error("Transaction failed:", error)
      
      // Send failure result back to WebSocket
      await sendTransactionResult(
        pendingTransaction.transactionId,
        false,
        undefined,
        undefined,
        error.message || "Transaction failed"
      )
      
      setError(error.message || "Transaction failed")
      setIsProcessingTransaction(false)
    }
  }

  const handleRejectTransaction = async () => {
    if (!pendingTransaction) return

    setIsProcessingTransaction(true)
    
    // Send rejection result back to WebSocket
    await sendTransactionResult(
      pendingTransaction.transactionId,
      false,
      undefined,
      undefined,
      "Transaction rejected by user"
    )
    
    setIsProcessingTransaction(false)
  }

  const handleDisconnect = async () => {
    if (!selector) return

    try {
      const state = selector.store.getState()
      if (state.selectedWalletId) {
        const wallet = await selector.wallet(state.selectedWalletId)
        await wallet.signOut()
      }
      setAccount(null)
    } catch (err) {
      setError("Failed to disconnect wallet")
      console.error("Wallet disconnection error:", err)
    }
  }

  // Show different status icons based on WebSocket and wallet status
  const getStatusIcon = () => {
    if (wsStatus === 'success') return <CheckCircle className="h-4 w-4 text-green-600" />
    if (wsStatus === 'error') return <AlertCircle className="h-4 w-4 text-red-600" />
    if (wsStatus === 'connecting' || isSending) return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
    if (wsStatus === 'connected') return <CheckCircle className="h-4 w-4 text-blue-600" />
    return <AlertCircle className="h-4 w-4 text-gray-400" />
  }

  const getStatusColor = () => {
    if (wsStatus === 'success') return 'bg-green-50 border-green-200 text-green-800'
    if (wsStatus === 'error') return 'bg-red-50 border-red-200 text-red-800'
    if (wsStatus === 'connected') return 'bg-blue-50 border-blue-200 text-blue-800'
    return 'bg-yellow-50 border-yellow-200 text-yellow-800'
  }

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #dbeafe 0%, #c7d2fe 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
      >
        <Card style={{ 
          width: "100%", 
          maxWidth: "400px"
        }}>
          <CardContent
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px",
            }}
          >
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span style={{ marginLeft: "12px", color: "#4b5563" }}>Initializing wallet...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #dbeafe 0%, #c7d2fe 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px", display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {/* Connection Status */}
        <Card>
          <CardContent style={{ padding: "16px" }}>
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${getStatusColor()}`}>
              {getStatusIcon()}
              <div className="flex-1">
                <div className="font-medium text-sm">Text Royale</div>
                <div className="text-xs">{wsMessage}</div>
                {sessionInfo && (
                  <div className="text-xs mt-1">
                    Player: <strong>{sessionInfo.username}</strong>
                  </div>
                )}
                {transactionMetadata && (
                  <div className="text-xs mt-1" style={{ color: "#f59e0b" }}>
                    💰 Transaction: {transactionMetadata.metadata?.originalAmount || (parseFloat(transactionMetadata.amount) / 1e24).toFixed(2)} NEAR to {transactionMetadata.receiver}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Wallet Card */}
        <Card>
          <CardHeader style={{ textAlign: "center" }}>
            <div
              style={{
                margin: "0 auto 16px",
                width: "48px",
                height: "48px",
                backgroundColor: "#2563eb",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Wallet style={{ width: "24px", height: "24px", color: "white" }} />
            </div>
            <CardTitle style={{ fontSize: "24px", fontWeight: "bold" }}>NEAR Wallet</CardTitle>
            <CardDescription>
              {transactionMetadata ? 
                `Complete your ${transactionMetadata.metadata?.originalAmount || (parseFloat(transactionMetadata.amount) / 1e24).toFixed(2)} NEAR payment` : 
                'Connect your Hot wallet for Text Royale'
              }
            </CardDescription>
          </CardHeader>
          <CardContent style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {error && (
              <Alert variant="destructive">
                <AlertCircle style={{ height: "16px", width: "16px" }} />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {account ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ textAlign: "center" }}>
                  <Badge variant="secondary" style={{ 
                    marginBottom: "12px"
                  }}>
                    {wsStatus === 'success' ? 'Connected to Text Royale' : 'Wallet Connected'}
                  </Badge>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                      <User style={{ width: "16px", height: "16px", color: "#6b7280" }} />
                      <span style={{ fontWeight: "500" }}>{account.accountId}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                      <Globe style={{ width: "16px", height: "16px", color: "#6b7280" }} />
                      <span style={{ fontSize: "14px", color: "#4b5563" }}>NEAR Testnet</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {wsStatus === 'success' ? (
                    <div style={{ textAlign: "center" }}>
                      <div className="text-4xl mb-2">🎉</div>
                      <div style={{ fontSize: "16px", color: "#16a34a", fontWeight: "500", marginBottom: "8px" }}>
                        Successfully connected to Text Royale!
                      </div>
                      <div style={{ fontSize: "12px", color: "#4b5563" }}>
                        You can now close this window and return to Telegram to start playing.
                      </div>
                    </div>
                  ) : wsStatus === 'connected' && isSending ? (
                    <div style={{ textAlign: "center" }}>
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                      <div style={{ fontSize: "14px", color: "#4b5563" }}>
                        Sending wallet information to Text Royale...
                      </div>
                    </div>
                  ) : wsStatus === 'connected' ? (
                    <div style={{ textAlign: "center" }}>
                      <Button 
                        onClick={() => handleSendToTelegram(account.accountId)} 
                        style={{ 
                          width: "100%", 
                          marginBottom: "8px"
                        }}
                        disabled={isSending}
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Sending to Text Royale...
                          </>
                        ) : (
                          'Send to Text Royale'
                        )}
                      </Button>
                      <div style={{ fontSize: "12px", color: "#4b5563" }}>
                        Click to complete your Text Royale connection
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "14px", color: "#4b5563", textAlign: "center" }}>
                      {wsStatus === 'error' ? 'Unable to connect to Text Royale. Please try refreshing.' : 
                       'Connecting to Text Royale...'}
                    </div>
                  )}

                  <Button 
                    onClick={handleDisconnect} 
                    variant="outline" 
                    style={{ width: "100%" }}
                  >
                    <LogOut style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                    Disconnect Wallet
                  </Button>
                </div>

                {/* Transaction Signing Modal */}
                {pendingTransaction && (
                  <Card style={{ border: "2px solid #f59e0b", backgroundColor: "#fef3c7" }}>
                    <CardHeader style={{ textAlign: "center", paddingBottom: "12px" }}>
                      <CardTitle style={{ fontSize: "18px", color: "#92400e", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                        <AlertCircle style={{ width: "20px", height: "20px" }} />
                        Transaction Approval Required
                      </CardTitle>
                    </CardHeader>
                    <CardContent style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div style={{ backgroundColor: "white", padding: "12px", borderRadius: "8px", border: "1px solid #d97706" }}>
                        <div style={{ fontSize: "14px", color: "#92400e", marginBottom: "8px" }}>
                          <strong>Transaction Details:</strong>
                        </div>
                        <div style={{ fontSize: "12px", color: "#451a03", fontFamily: "monospace" }}>
                          ID: {pendingTransaction.transactionId}
                        </div>
                        {pendingTransaction.transactionData?.receiverId && (
                          <div style={{ fontSize: "12px", color: "#451a03", marginTop: "4px" }}>
                            Contract: {pendingTransaction.transactionData.receiverId}
                          </div>
                        )}
                        {pendingTransaction.transactionData?.methodName && (
                          <div style={{ fontSize: "12px", color: "#451a03", marginTop: "4px" }}>
                            Method: {pendingTransaction.transactionData.methodName}
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button 
                          onClick={() => handleSignTransaction(pendingTransaction.transactionData)}
                          disabled={isProcessingTransaction}
                          style={{ 
                            flex: 1,
                            backgroundColor: "#16a34a",
                            borderColor: "#16a34a"
                          }}
                        >
                          {isProcessingTransaction ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                              Sign Transaction
                            </>
                          )}
                        </Button>
                        
                        <Button 
                          onClick={handleRejectTransaction}
                          disabled={isProcessingTransaction}
                          variant="outline"
                          style={{ 
                            flex: 1,
                            borderColor: "#dc2626",
                            color: "#dc2626"
                          }}
                        >
                          <AlertCircle style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ textAlign: "center", fontSize: "14px", color: "#4b5563" }}>
                  {wsStatus === 'connected' ? 
                    `Connect your NEAR wallet to join Text Royale as ${sessionInfo?.username || 'Player'}` :
                    'Waiting for Text Royale connection...'
                  }
                </div>

                <Button 
                  onClick={handleConnect} 
                  disabled={isConnecting || !selector || wsStatus !== 'connected'} 
                  style={{ width: "100%" }}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                      Connect NEAR Wallet
                    </>
                  )}
                </Button>

                <div style={{ fontSize: "12px", color: "#6b7280", textAlign: "center" }}>
                  Supports Hot Wallet, Meteor Wallet, and Intear Wallet
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}