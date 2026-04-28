'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StellarWallet } from '@/lib/stellar'
import { truncateAddress } from '@/lib/utils'
import { Wallet, Home, Search, User, FileText } from 'lucide-react'

interface HeaderProps {
  wallet?: StellarWallet
}

export function Header({ wallet }: HeaderProps) {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">K</span>
              </div>
              <span className="font-bold text-xl">kor-AssetForge</span>
            </Link>
            
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/" className="flex items-center space-x-1 text-sm font-medium hover:text-primary">
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Link>
              <Link href="/marketplace" className="flex items-center space-x-1 text-sm font-medium hover:text-primary">
                <Search className="h-4 w-4" />
                <span>Marketplace</span>
              </Link>
              {wallet && (
                <>
                  <Link href="/dashboard" className="flex items-center space-x-1 text-sm font-medium hover:text-primary">
                    <User className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                  <Link href="/kyc" className="flex items-center space-x-1 text-sm font-medium hover:text-primary">
                    <FileText className="h-4 w-4" />
                    <span>KYC</span>
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {wallet ? (
              <div className="flex items-center space-x-2">
                <div className="hidden md:flex items-center space-x-2 px-3 py-1 bg-muted rounded-lg">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-mono">
                    {truncateAddress(wallet.publicKey)}
                  </span>
                </div>
                <Button variant="outline" size="sm">
                  Connected
                </Button>
              </div>
            ) : (
              <Button size="sm">
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
