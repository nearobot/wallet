"use client"

import { useState, useEffect, useRef } from "react"
import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core"
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui"
import "@near-wallet-selector/modal-ui/styles.css"
import { setupHotWallet } from "@near-wallet-selector/hot-wallet"
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet"
import { setupIntearWallet } from "@near-wallet-selector/intear-wallet"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Badge } from "../../components/ui/badge"
import { Separator } from "../../components/ui/separator"
import { Wallet, LogOut, User, Globe, AlertCircle, CheckCircle, Loader2, Send } from "lucide-react"
import { Alert, AlertDescription } from "../../components/ui/alert"

interface Account {
  accountId: string
}

interface TransactionData {
  amount: string
  receiver: string
  purpose?: string
  method?: string
  metadata?: {
    originalAmount: string
    currency: string
  }
}

// WebSocket hook for getting transaction data
const useWebSocketTransaction = () => {
  const [wsStatus, setWsStatus] = useState('connecting')
  const [wsMessage, setWsMessage] = useState('Connecting to server...')
  const [transactionData, setTransactionData] = useState<TransactionData | null>(null)
  const [sessionInfo, setSessionInfo] = useState<{userId: string, username: string} | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  // Get session ID from URL
  const getSessionIdFromUrl = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('sessionId')
    }
    return null
  }

  // Initialize WebSocket connection
  const initializeConnection = () => {
    try {
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'https://ws.textroyale.com/'
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        console.log('WebSocket connection established')
        setWsStatus('connected')
        setWsMessage('Connected. Initializing session...')

        // Initialize session to get transaction data
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
          setWsMessage('Invalid response from server')
          setWsStatus('error')
        }
      }

      wsRef.current.onclose = () => {
        console.log('WebSocket connection closed')
        setWsStatus('error')
        setWsMessage('Connection lost. Please refresh.')
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setWsMessage('Connection error. Please refresh.')
        setWsStatus('error')
      }

    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error)
      setWsMessage('Failed to connect. Please refresh.')
      setWsStatus('error')
    }
  }

  // Handle WebSocket messages
  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'session_initialized':
        console.log('Session initialized:', message)
        setSessionInfo({
          userId: message.userId || 'unknown',
          username: message.username || 'Player'
        })
        
        if (message.transactionData) {
          console.log('Received transaction data:', message.transactionData)
          setTransactionData(message.transactionData)
          const displayAmount = message.transactionData.metadata?.originalAmount || 
                               (parseFloat(message.transactionData.amount) / 1e24).toFixed(2)
          setWsMessage(`Transaction ready: ${displayAmount} NEAR to ${message.transactionData.receiver}`)
          setWsStatus('ready')
        } else {
          setWsMessage('No transaction data found for this session')
          setWsStatus('error')
        }
        break

      case 'transaction_result_received':
        setWsMessage('Transaction completed successfully!')
        setWsStatus('success')
        setIsProcessing(false)
        break

      case 'wallet_disconnection_received':
        console.log('Wallet disconnection confirmed by server')
        setWsMessage('Wallet disconnected successfully!')
        setWsStatus('success')
        setIsProcessing(false)
        break

      case 'error':
        setWsMessage(message.message || 'An error occurred')
        setWsStatus('error')
        setIsProcessing(false)
        break

      case 'pong':
        // Handle ping-pong for connection health
        break

      default:
        console.log('Unknown message type:', message.type)
    }
  }

  // Send transaction result back to server
  const sendTransactionResult = async (success: boolean, txId: string, txHash?: string, error?: string) => {
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
        transactionId: txId, // Server expects transactionId, not txId
        sessionId: sessionIdRef.current,
        success,
        timestamp: new Date().toISOString(),
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

  // Send wallet disconnection to server
  const sendWalletDisconnection = async (reason?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected')
      return false
    }

    if (!sessionIdRef.current) {
      console.error('No session ID')
      return false
    }

    try {
      const disconnectData = {
        type: 'wallet_disconnected',
        sessionId: sessionIdRef.current,
        reason: reason || 'User requested disconnection',
        timestamp: new Date().toISOString()
      }

      console.log('Sending wallet disconnection:', disconnectData)
      wsRef.current.send(JSON.stringify(disconnectData))
      return true
    } catch (error) {
      console.error('Error sending wallet disconnection:', error)
      return false
    }
  }

  // Initialize on mount
  useEffect(() => {
    const sessionId = getSessionIdFromUrl()
    
    if (!sessionId) {
      setWsMessage('No session ID found. Please start from the correct link.')
      setWsStatus('error')
      return
    }

    sessionIdRef.current = sessionId
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
    transactionData,
    sessionInfo,
    isProcessing,
    setIsProcessing,
    sendTransactionResult,
    sendWalletDisconnection
  }
}

export default function SendPage() {
  const [selector, setSelector] = useState<WalletSelector | null>(null)
  const [modal, setModal] = useState<WalletSelectorModal | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [success, setSuccess] = useState<string | null>(null)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [allowDisconnect, setAllowDisconnect] = useState(false)

  // Check if disconnect is allowed from URL
  const getDisconnectFromUrl = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get('disconnect') === 'true'
    }
    return false
  }

  // WebSocket integration
  const {
    wsStatus,
    wsMessage,
    transactionData,
    sessionInfo,
    isProcessing,
    setIsProcessing,
    sendTransactionResult,
    sendWalletDisconnection
  } = useWebSocketTransaction()

  // Static configuration for token transfers
  const TOKEN_CONTRACT = "splaunch.testnet" // or your token contract
  const STATIC_RECEIVER = "blueoil4632.testnet" // Static receiver
  const TOKEN_DECIMALS = 8 // Most tokens use 18 decimals, adjust as needed
  const TOKEN_SYMBOL = "SP" // Token symbol for display

  // Format token amount for display
  const formatToken = (amount: string, decimals: number = TOKEN_DECIMALS): string => {
    try {
      const amountBN = parseFloat(amount)
      const divisor = Math.pow(10, decimals)
      const formatted = (amountBN / divisor).toFixed(2)
      
      // Remove trailing zeros and unnecessary decimal point
      const cleaned = parseFloat(formatted).toString()
      
      return `${cleaned} ${TOKEN_SYMBOL}`
    } catch (error) {
      console.error('Error formatting token amount:', error)
      return `${amount} tokens`
    }
  }

  // Get display amount from transaction data
  const getDisplayAmount = (transactionData: TransactionData): string => {
    if (transactionData.metadata?.originalAmount) {
      return `${transactionData.metadata.originalAmount} ${TOKEN_SYMBOL}`
    }
    return formatToken(transactionData.amount)
  }

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

        // Setup the modal
        const walletModal = setupModal(walletSelector, {
          contractId: TOKEN_CONTRACT,
        })
        setModal(walletModal)

        // Subscribe to wallet state changes
        const subscription = walletSelector.store.observable.subscribe((state) => {
          if (state.accounts.length > 0) {
            const newAccount = { accountId: state.accounts[0].accountId }
            setAccount(newAccount)
          } else {
            setAccount(null)
          }
        })

        // Check current state
        const currentState = walletSelector.store.getState()
        if (currentState.accounts.length > 0) {
          const currentAccount = { accountId: currentState.accounts[0].accountId }
          setAccount(currentAccount)
        }

        return () => subscription.unsubscribe()
      } catch (err) {
        setError("Failed to initialize wallet selector")
        console.error("Wallet selector initialization error:", err)
      } finally {
        setIsLoading(false)
      }
    }

    initWalletSelector()
  }, [])

  // Check URL parameters on mount
  useEffect(() => {
    setAllowDisconnect(getDisconnectFromUrl())
  }, [])

  const handleConnect = async () => {
    if (!modal) {
      setError("Wallet selector not initialized")
      return
    }

    setError(null)
    modal.show()
  }

  const handleSendTokens = async () => {
    if (!selector || !account || !transactionData) {
      setError("Missing requirements for transaction")
      return
    }

    // Generate transaction ID
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setTransactionId(txId)
    setIsProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      const state = selector.store.getState()
      if (!state.selectedWalletId) {
        throw new Error("No wallet selected")
      }

      const wallet = await selector.wallet(state.selectedWalletId)
      
      console.log("Sending token transfer:", {
        contract: TOKEN_CONTRACT,
        receiver: STATIC_RECEIVER,
        amount: transactionData.amount,
        transactionId: txId
      })

      // Send fungible token transfer
      const result = await wallet.signAndSendTransaction({
        receiverId: TOKEN_CONTRACT,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "ft_transfer",
              args: {
                receiver_id: STATIC_RECEIVER,
                amount: transactionData.amount,
                memo: transactionData.purpose || "Token transfer"
              },
              gas: "300000000000000", // 300 TGas
              deposit: "1" // 1 yoctoNEAR for storage
            }
          }
        ]
      })

      console.log("Transfer result:", result)
      
      // Extract transaction hash
      const txHash = typeof result === 'object' && result && 'transaction' in result 
        ? result.transaction?.hash 
        : undefined

      // Send success result back to WebSocket with transaction ID
      await sendTransactionResult(true, txId, txHash)
      
      const displayAmount = getDisplayAmount(transactionData)
      setSuccess(`Successfully sent ${displayAmount} to ${STATIC_RECEIVER}`)
      
    } catch (error: any) {
      console.error("Transfer failed:", error)
      
      // Send failure result back to WebSocket with transaction ID
      await sendTransactionResult(false, txId, undefined, error.message)
      
      setError(error.message || "Transfer failed")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!selector) return

    setIsProcessing(true)
    setError(null)

    try {
      // First, notify the WebSocket server about the disconnection
      await sendWalletDisconnection('User requested wallet disconnection')

      // Then disconnect from the wallet
      const state = selector.store.getState()
      if (state.selectedWalletId) {
        const wallet = await selector.wallet(state.selectedWalletId)
        await wallet.signOut()
      }
      
      setAccount(null)
      setSuccess(null)
      setError(null)
      
      console.log('Wallet disconnected successfully')
      
    } catch (err) {
      setError("Failed to disconnect wallet")
      console.error("Wallet disconnection error:", err)
      setIsProcessing(false)
    }
  }

  // Show different status icons
  const getStatusIcon = () => {
    if (wsStatus === 'success') return <CheckCircle className="h-4 w-4 text-green-600" />
    if (wsStatus === 'error') return <AlertCircle className="h-4 w-4 text-red-600" />
    if (wsStatus === 'connecting' || isProcessing) return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
    if (wsStatus === 'ready') return <CheckCircle className="h-4 w-4 text-blue-600" />
    return <AlertCircle className="h-4 w-4 text-gray-400" />
  }

  const getStatusColor = () => {
    if (wsStatus === 'success') return 'bg-green-50 border-green-200 text-green-800'
    if (wsStatus === 'error') return 'bg-red-50 border-red-200 text-red-800'
    if (wsStatus === 'ready') return 'bg-blue-50 border-blue-200 text-blue-800'
    return 'bg-yellow-50 border-yellow-200 text-yellow-800'
  }

  // Close the current tab/window
  const handleBackToTelegram = () => {
    if (typeof window !== 'undefined') {
      window.close()
      // Fallback: try to navigate to telegram if close doesn't work
      setTimeout(() => {
        window.location.href = 'https://t.me'
      }, 500)
    }
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
                <div className="font-medium text-sm">Transaction Status</div>
                <div className="text-xs">{wsMessage}</div>
                {sessionInfo && (
                  <div className="text-xs mt-1">
                    Session: <strong>{sessionInfo.username}</strong>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Send Card */}
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
              <Send style={{ width: "24px", height: "24px", color: "white" }} />
            </div>
            <CardTitle style={{ fontSize: "24px", fontWeight: "bold" }}>Send Tokens</CardTitle>
            <CardDescription>
              {transactionData ? 
                `Ready to send ${getDisplayAmount(transactionData)} to ${STATIC_RECEIVER}` : 
                'Loading transaction data...'
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
                    Wallet Connected
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
                  {success ? (
                    <div style={{ textAlign: "center" }}>
                      <div className="text-4xl mb-2">🎉</div>
                      <div style={{ fontSize: "16px", color: "#16a34a", fontWeight: "500", marginBottom: "8px" }}>
                        {success}
                      </div>
                      <div style={{ fontSize: "12px", color: "#4b5563" }}>
                        Transaction completed successfully!
                      </div>
                    </div>
                  ) : transactionData && wsStatus === 'ready' ? (
                    <>
                      {/* Transaction Details */}
                      <Card style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <CardContent style={{ padding: "16px" }}>
                          <div style={{ fontSize: "14px", fontWeight: "500", marginBottom: "8px" }}>
                            Transaction Details:
                          </div>
                          <div style={{ fontSize: "12px", color: "#4b5563", fontFamily: "monospace" }}>
                            <div>Amount: {getDisplayAmount(transactionData)}</div>
                            <div>To: {STATIC_RECEIVER}</div>
                            <div>Contract: {TOKEN_CONTRACT}</div>
                            {transactionData.purpose && <div>Purpose: {transactionData.purpose}</div>}
                          </div>
                        </CardContent>
                      </Card>

                      <Button 
                        onClick={handleSendTokens}
                        disabled={isProcessing}
                        style={{ 
                          width: "100%",
                          backgroundColor: "#16a34a",
                          borderColor: "#16a34a"
                        }}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Send style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                            Send Tokens
                          </>
                        )}
                      </Button>
                    </>
                  ) : wsStatus === 'error' ? (
                    <div style={{ textAlign: "center", fontSize: "14px", color: "#dc2626" }}>
                      {wsMessage}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", fontSize: "14px", color: "#4b5563" }}>
                      Loading transaction data...
                    </div>
                  )}

                  {/* Conditional buttons based on connection status and URL params */}
                  {(account || success) ? (
                    <Button 
                      onClick={handleBackToTelegram} 
                      style={{ 
                        width: "100%",
                        backgroundColor: "#0088cc",
                        borderColor: "#0088cc",
                        color: "white"
                      }}
                    >
                      <span style={{ fontSize: "16px", marginRight: "8px" }}>📱</span>
                      Back To Telegram
                    </Button>
                  ) : null}

                  {/* Show disconnect button only if allowed by URL parameter */}
                  {allowDisconnect && account && !success && (
                    <Button 
                      onClick={handleDisconnect} 
                      variant="outline" 
                      style={{ width: "100%" }}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Disconnecting...
                        </>
                      ) : (
                        <>
                          <LogOut style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                          Disconnect Wallet
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ textAlign: "center", fontSize: "14px", color: "#4b5563" }}>
                  {wsStatus === 'ready' && transactionData ? 
                    `Connect your NEAR wallet to send ${getDisplayAmount(transactionData)}` :
                    'Please wait while we load your transaction...'
                  }
                </div>

                <Button 
                  onClick={handleConnect} 
                  disabled={isConnecting || !selector || wsStatus !== 'ready'} 
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
                  Choose from multiple wallet options
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 