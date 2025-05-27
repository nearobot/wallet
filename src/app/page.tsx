"use client"

import { useState, useEffect } from "react"
import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core"
import { setupHotWallet } from "@near-wallet-selector/hot-wallet"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Separator } from "../components/ui/separator"
import { Wallet, LogOut, User, Globe, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "../components/ui/alert"

interface Account {
  accountId: string
}

export default function WalletConnector() { 
  const [selector, setSelector] = useState<WalletSelector | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
            setAccount({ accountId: state.accounts[0].accountId })
          } else {
            setAccount(null)
          }
        })

        // Check current state
        const currentState = walletSelector.store.getState()
        console.log("Current wallet state:", currentState)
        if (currentState.accounts.length > 0) {
          setAccount({ accountId: currentState.accounts[0].accountId })
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
        contractId: "example.testnet",
        methodNames: [],
        accounts: []
      })

      console.log("Sign in result:", result)

      // Get accounts after signing in
      const accounts = await wallet.getAccounts()
      console.log("Accounts:", accounts)

      if (accounts.length > 0) {
        setAccount({ accountId: accounts[0].accountId })
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
            <div
              style={{
                width: "32px",
                height: "32px",
                border: "2px solid #2563eb",
                borderTop: "2px solid transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            ></div>
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
            <CardDescription>Connect your Hot wallet to interact with NEAR Protocol</CardDescription>
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
                    Connected
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
                  <div style={{ fontSize: "14px", color: "#4b5563", textAlign: "center" }}>
                    Your wallet is successfully connected. You can now interact with NEAR dApps.
                  </div>

                  <Button onClick={handleDisconnect} variant="outline" style={{ width: "100%" }}>
                    <LogOut style={{ width: "16px", height: "16px", marginRight: "8px" }} />
                    Disconnect Wallet
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ textAlign: "center", fontSize: "14px", color: "#4b5563" }}>
                  Connect your Hot wallet to get started with NEAR Protocol applications.
                </div>

                <Button onClick={handleConnect} disabled={isConnecting || !selector} style={{ width: "100%" }}>
                  {isConnecting ? (
                    <>
                      <div
                        style={{
                          width: "16px",
                          height: "16px",
                          border: "2px solid white",
                          borderTop: "2px solid transparent",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                          marginRight: "8px",
                        }}
                      ></div>
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

        <Card>
          <CardContent style={{ padding: "16px" }}>
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "8px" }}>
              <h3 style={{ fontWeight: "600", fontSize: "14px" }}>About Hot Wallet</h3>
              <p style={{ fontSize: "12px", color: "#4b5563" }}>
                Hot is a secure wallet for the NEAR Protocol ecosystem, providing easy access to decentralized
                applications and digital assets.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
