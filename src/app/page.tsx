"use client"

import { useState, useEffect, useRef } from "react"
import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core"
import { setupHotWallet } from "@near-wallet-selector/hot-wallet"
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
  
  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const retryAttemptsRef = useRef(0)
  const maxRetries = 3

  // Get session ID from URL parameters
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
      // Update this URL to point to your WebSocket server
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://69.62.112.25:3001'
      
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
        break

      case 'wallet_connection_received':
        setWsMessage('Wallet connected successfully! You can close this window.')
        setWsStatus('success')
        break

      case 'error':
        setWsMessage(message.message)
        setWsStatus('error')
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

  // Initialize connection on mount
  useEffect(() => {
    // Get session ID from URL
    const sessionId = getSessionIdFromUrl()
    
    if (!sessionId) {
      setWsMessage('No session ID found. Please start from Telegram bot.')
      setWsStatus('error')
      return
    }

    sessionIdRef.current = sessionId
    setWsMessage('Connecting to Text Royale...')
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
    sendWalletData
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
    sendWalletData
  } = useTextRoyaleWebSocket()

  useEffect(() => {
    const initWalletSelector = async () => {
      try {
        const walletSelector = await setupWalletSelector({
          network: "testnet",
          modules: [
            setupHotWallet(),
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

  const handleConnect = async () => {
    if (!selector) {
      setError("Wallet selector not initialized")
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      console.log("Attempting to connect to Hot wallet...")

      // Get the Hot wallet
      const wallet = await selector.wallet("hot-wallet")
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
      setError(err.message || "Failed to connect wallet. Make sure Hot wallet is installed.")
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
        <Card style={{ width: "100%", maxWidth: "448px" }}>
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
      <div style={{ width: "100%", maxWidth: "448px", display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {/* Text Royale Connection Status */}
        <Card>
          <CardContent style={{ padding: "16px" }}>
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${getStatusColor()}`}>
              {getStatusIcon()}
              <div className="flex-1">
                <div className="font-medium text-sm">🎮 Text Royale</div>
                <div className="text-xs">{wsMessage}</div>
                {sessionInfo && (
                  <div className="text-xs mt-1">
                    Player: <strong>{sessionInfo.username}</strong>
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
            <CardTitle style={{ fontSize: "24px", fontWeight: "bold" }}>NEAR Wallet Connection</CardTitle>
            <CardDescription>Connect your Hot wallet for Text Royale</CardDescription>
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
                  <Badge variant="secondary" style={{ marginBottom: "8px" }}>
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
                      <div style={{ fontSize: "14px", color: "#16a34a", fontWeight: "500", marginBottom: "8px" }}>
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
                        style={{ width: "100%", marginBottom: "8px" }}
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

                  <Button onClick={handleDisconnect} variant="outline" style={{ width: "100%" }}>
                    <LogOut style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                    Disconnect Wallet
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ textAlign: "center", fontSize: "14px", color: "#4b5563" }}>
                  {wsStatus === 'connected' ? 
                    `Connect your Hot wallet to join Text Royale as ${sessionInfo?.username || 'Player'}` :
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
                      Connect Hot Wallet
                    </>
                  )}
                </Button>

                <div style={{ fontSize: "12px", color: "#6b7280", textAlign: "center" }}>
                  Make sure you have the Hot wallet extension installed in your browser.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardContent style={{ padding: "16px" }}>
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "8px" }}>
              <h3 style={{ fontWeight: "600", fontSize: "14px" }}>About Text Royale</h3>
              <p style={{ fontSize: "12px", color: "#4b5563" }}>
                A blockchain-based battle royale game on NEAR Protocol. Connect your wallet to earn tokens and participate in epic battles!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}