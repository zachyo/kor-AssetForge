'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { stellarService, StellarWallet } from '@/lib/stellar'
import { truncateAddress } from '@/lib/utils'
import { Wallet, LogOut } from 'lucide-react'

interface WalletConnectProps {
  onWalletConnected: (wallet: StellarWallet) => void
  onWalletDisconnected: () => void
  wallet?: StellarWallet
}

export function WalletConnect({ onWalletConnected, onWalletDisconnected, wallet }: WalletConnectProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleConnect = async () => {
    setIsLoading(true)
    try {
      const connectedWallet = await stellarService.connectWallet()
      onWalletConnected(connectedWallet)
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      // You could add a toast notification here
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    setIsLoading(true)
    try {
      await stellarService.disconnectWallet()
      onWalletDisconnected()
    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (wallet?.connected) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Connected
          </CardTitle>
          <CardDescription>
            Your Stellar wallet is connected and ready
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-mono">
              {truncateAddress(wallet.publicKey)}
            </p>
          </div>
          <Button 
            onClick={handleDisconnect} 
            variant="outline" 
            className="w-full"
            disabled={isLoading}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {isLoading ? 'Disconnecting...' : 'Disconnect'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Connect Wallet
        </CardTitle>
        <CardDescription>
          Connect your Freighter wallet to access the marketplace
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleConnect} 
          className="w-full"
          disabled={isLoading}
        >
          <Wallet className="h-4 w-4 mr-2" />
          {isLoading ? 'Connecting...' : 'Connect Freighter Wallet'}
        </Button>
      </CardContent>
    </Card>
  )
}
