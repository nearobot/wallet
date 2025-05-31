"use client"

import { useState, useEffect } from "react"
import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core"
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui"
import "@near-wallet-selector/modal-ui/styles.css"
import { setupHotWallet } from "@near-wallet-selector/hot-wallet"
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet"
import { setupIntearWallet } from "@near-wallet-selector/intear-wallet"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Separator } from "../components/ui/separator"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Wallet, LogOut, User, Globe, AlertCircle, CheckCircle, Loader2, Send } from "lucide-react"
import { Alert, AlertDescription } from "../components/ui/alert"

interface Account {
  accountId: string
}

export default function TokenSender() { 
  const [selector, setSelector] = useState<WalletSelector | null>(null)
  const [modal, setModal] = useState<WalletSelectorModal | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  
  // Transfer form state
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [memo, setMemo] = useState("")
  const [success, setSuccess] = useState<string | null>(null)

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
          contractId: "textroyale.testnet",
        })
        setModal(walletModal)

        console.log("Available wallets:", walletSelector.store.getState().modules.map(w => ({ id: w.id, name: w.metadata.name })))

        // Subscribe to wallet state changes
        const subscription = walletSelector.store.observable.subscribe((state) => {
          console.log("Wallet state changed:", state)
          if (state.accounts.length > 0) {
            const newAccount = { accountId: state.accounts[0].accountId }
            setAccount(newAccount)
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
  }, [])

  const handleConnect = async () => {
    if (!modal) {
      setError("Wallet selector not initialized")
      return
    }

    setError(null)
    modal.show()
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
      setSuccess(null)
      setError(null)
    } catch (err) {
      setError("Failed to disconnect wallet")
      console.error("Wallet disconnection error:", err)
    }
  }

  const handleSendTokens = async () => {
    if (!selector || !account) {
      setError("Please connect your wallet first")
      return
    }

    if (!recipient || !amount) {
      setError("Please fill in recipient and amount")
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount")
      return
    }

    setIsSending(true)
    setError(null)
    setSuccess(null)

    try {
      const state = selector.store.getState()
      if (!state.selectedWalletId) {
        throw new Error("No wallet selected")
      }

      const wallet = await selector.wallet(state.selectedWalletId)
      
      // Convert amount to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
      const amountInYocto = (amountNum * 1e24).toString()

      console.log("Sending transaction:", {
        receiverId: recipient,
        amount: amountInYocto,
        memo: memo || undefined
      })

      // Send NEAR transfer
      const result = await wallet.signAndSendTransaction({
        receiverId: recipient,
        actions: [
          {
            type: "Transfer",
            params: {
              deposit: amountInYocto
            }
          }
        ]
      })

      console.log("Transfer result:", result)
      
      setSuccess(`Successfully sent ${amount} NEAR to ${recipient}`)
      
      // Clear form
      setRecipient("")
      setAmount("")
      setMemo("")
      
    } catch (error: any) {
      console.error("Transfer failed:", error)
      setError(error.message || "Transfer failed")
    } finally {
      setIsSending(false)
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
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
              {error ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {error ? error : success ? success : account ? 'Wallet Connected' : 'Ready to Connect'}
                </div>
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
            <CardTitle style={{ fontSize: "24px", fontWeight: "bold" }}>Send NEAR Tokens</CardTitle>
            <CardDescription>
              {account ? 
                `Send NEAR tokens from ${account.accountId}` : 
                'Connect your NEAR wallet to send tokens'
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
                    {success ? 'Connected to wallet' : 'Wallet Connected'}
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
                  ) : (
                    <>
                      {/* Token Sending Form */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div>
                          <Label htmlFor="recipient" style={{ marginBottom: "6px", display: "block" }}>
                            Recipient Account
                          </Label>
                          <Input
                            id="recipient"
                            type="text"
                            placeholder="account.testnet"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            disabled={isSending}
                          />
                        </div>

                        <div>
                          <Label htmlFor="amount" style={{ marginBottom: "6px", display: "block" }}>
                            Amount (NEAR)
                          </Label>
                          <Input
                            id="amount"
                            type="number"
                            placeholder="0.1"
                            step="0.001"
                            min="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            disabled={isSending}
                          />
                        </div>

                        <div>
                          <Label htmlFor="memo" style={{ marginBottom: "6px", display: "block" }}>
                            Memo (optional)
                          </Label>
                          <Input
                            id="memo"
                            type="text"
                            placeholder="Payment description"
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            disabled={isSending}
                          />
                        </div>

                        <Button 
                          onClick={handleSendTokens}
                          disabled={isSending || !recipient || !amount}
                          style={{ 
                            width: "100%",
                            backgroundColor: "#16a34a",
                            borderColor: "#16a34a"
                          }}
                        >
                          {isSending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                              Send NEAR
                            </>
                          )}
                        </Button>
                      </div>

                      <Separator style={{ margin: "8px 0" }} />
                    </>
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
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ textAlign: "center", fontSize: "14px", color: "#4b5563" }}>
                  {!account ? 
                    `Connect your NEAR wallet to send tokens` :
                    'Waiting for connection...'
                  }
                </div>

                <Button 
                  onClick={handleConnect} 
                  disabled={isConnecting || !selector || !!account} 
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
                      Choose NEAR Wallet
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