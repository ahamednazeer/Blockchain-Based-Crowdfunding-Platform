'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface WalletContextType {
    account: string | null;
    isConnected: boolean;
    isAdmin: boolean;
    role: string;
    connecting: boolean;
    hasMetaMask: boolean;
    walletName: string;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
}

interface WalletNotice {
    title: string;
    message: string;
    variant: 'info' | 'error';
}

const WalletContext = createContext<WalletContextType>({
    account: null,
    isConnected: false,
    isAdmin: false,
    role: 'guest',
    connecting: false,
    hasMetaMask: false,
    walletName: '',
    connectWallet: async () => { },
    disconnectWallet: () => { },
});

export function useWallet() {
    return useContext(WalletContext);
}

/**
 * Returns the injected Ethereum provider (MetaMask, Brave Wallet, etc.)
 */
function getProvider(): any | null {
    if (typeof window === 'undefined') return null;
    const ethereum = (window as any).ethereum;
    if (!ethereum) return null;

    // Prefer MetaMask if multiple providers
    if (ethereum.providers?.length) {
        const mm = ethereum.providers.find((p: any) => p.isMetaMask);
        if (mm) return mm;
    }

    return ethereum;
}

/** Detect the wallet/provider name from injected provider flags */
function detectWalletName(provider: any): string {
    if (!provider) return '';
    if (provider.isMetaMask && !provider.isBraveWallet) return 'MetaMask';
    if (provider.isBraveWallet) return 'Brave Wallet';
    if (provider.isCoinbaseWallet) return 'Coinbase Wallet';
    if (provider.isRabby) return 'Rabby';
    if (provider.isTrust) return 'Trust Wallet';
    if (provider.isPhantom) return 'Phantom';
    if (provider.isMetaMask) return 'MetaMask'; // fallback
    return 'Wallet';
}

export function WalletProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [account, setAccount] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [hasMetaMask, setHasMetaMask] = useState(false);
    const [walletName, setWalletName] = useState('');
    const [notice, setNotice] = useState<WalletNotice | null>(null);
    const noticeTimerRef = useRef<number | null>(null);

    const clearNotice = useCallback(() => {
        if (noticeTimerRef.current) {
            window.clearTimeout(noticeTimerRef.current);
            noticeTimerRef.current = null;
        }
        setNotice(null);
    }, []);

    const showNotice = useCallback((payload: WalletNotice) => {
        if (noticeTimerRef.current) {
            window.clearTimeout(noticeTimerRef.current);
        }
        setNotice(payload);
        noticeTimerRef.current = window.setTimeout(() => {
            setNotice(null);
            noticeTimerRef.current = null;
        }, 5000);
    }, []);

    useEffect(() => {
        return () => {
            if (noticeTimerRef.current) {
                window.clearTimeout(noticeTimerRef.current);
            }
        };
    }, []);

    const handleDisconnect = useCallback(() => {
        setAccount(null);
        setIsAdmin(false);
        setWalletName('');
        api.clearToken();
        localStorage.removeItem('walletAddress');
        localStorage.removeItem('walletRole');
        localStorage.removeItem('walletName');
    }, []);

    // Detect wallet/provider on mount
    useEffect(() => {
        const detect = () => {
            const p = getProvider();
            setHasMetaMask(!!p);
            if (p) setWalletName(detectWalletName(p));
        };
        detect();
        const timer = setTimeout(detect, 1000);
        return () => clearTimeout(timer);
    }, []);

    // Restore session on mount
    useEffect(() => {
        const token = api.getToken();
        const savedAccount = localStorage.getItem('walletAddress');
        const savedRole = localStorage.getItem('walletRole');
        if (token && savedAccount) {
            setAccount(savedAccount);
            setIsAdmin(savedRole === 'admin');
            const savedWallet = localStorage.getItem('walletName');
            if (savedWallet) setWalletName(savedWallet);
        }
    }, []);

    // Listen for account changes in MetaMask
    useEffect(() => {
        const provider = getProvider();
        if (!provider) return;

        const handler = async (accounts: string[]) => {
            if (accounts.length === 0) {
                // Wallet disconnected
                handleDisconnect();
            } else {
                const newAddr = accounts[0].toLowerCase();
                const currentAddr = account?.toLowerCase();

                if (currentAddr && newAddr !== currentAddr) {
                    // Wallet SWITCHED — disconnect old session, prompt re-auth
                    handleDisconnect();
                    showNotice({
                        title: 'Wallet Changed',
                        message: 'Please reconnect to authenticate with the new wallet address.',
                        variant: 'info',
                    });
                }
            }
        };

        provider.on('accountsChanged', handler);
        return () => provider.removeListener('accountsChanged', handler);
    }, [account, showNotice, handleDisconnect]);

    /**
     * Connect wallet with signature-based auth:
     * 1. getSigner() -> MetaMask popup to select account
     * 2. GET /nonce -> backend returns nonce + exact message
     * 3. signer.signMessage() -> MetaMask popup to sign
     * 4. POST /verify -> backend recovers signer, issues JWT
     * 5. Redirect to dashboard (admin or user)
     */
    const connectWallet = useCallback(async () => {
        const rawProvider = getProvider();
        if (!rawProvider) {
            showNotice({
                title: 'Wallet Not Found',
                message: 'No Ethereum wallet detected. Install MetaMask (or another wallet) and try again.',
                variant: 'error',
            });
            return;
        }

        setConnecting(true);
        try {
            const { ethers } = await import('ethers');
            const provider = new ethers.BrowserProvider(rawProvider);

            // Step 1: Connect + get signer
            const signer = await provider.getSigner();
            const address = await signer.getAddress();

            console.log('[Auth] Connected wallet:', address);

            // Step 2: Get nonce + message from backend
            const { nonce, message } = await api.getNonce(address.toLowerCase());

            // Step 3: Sign the message (MetaMask popup)
            const signature = await signer.signMessage(message);

            // Step 4: Verify on backend
            const response = await api.verifySignature(signature, nonce);

            // Step 5: Store session
            const authedAddress = response.user.walletAddress;
            const role = response.user.role;

            setAccount(authedAddress);
            setIsAdmin(role === 'admin');
            const detectedName = detectWalletName(rawProvider);
            setWalletName(detectedName);
            localStorage.setItem('walletAddress', authedAddress);
            localStorage.setItem('walletRole', role);
            localStorage.setItem('walletName', detectedName);

            console.log('[Auth] Authenticated as:', authedAddress, 'role:', role, 'via:', detectedName);

            // Step 6: Redirect to appropriate dashboard
            if (role === 'admin') {
                router.push('/admin');
            } else {
                router.push('/dashboard');
            }
        } catch (error: any) {
            const code = error?.code ?? error?.info?.error?.code;
            const isUserRejected = code === 4001 || code === 'ACTION_REJECTED';

            if (isUserRejected) {
                console.log('User rejected wallet signature request');
                showNotice({
                    title: 'Signature Cancelled',
                    message: 'You cancelled the wallet signature request. Approve the signature to log in.',
                    variant: 'info',
                });
            } else if (code === -32002) {
                console.warn('Wallet is already processing a request');
                showNotice({
                    title: 'Request Pending',
                    message: 'Your wallet already has a pending request. Open MetaMask and complete or cancel it.',
                    variant: 'info',
                });
            } else {
                console.error('Wallet connection failed:', error);
                showNotice({
                    title: 'Connection Failed',
                    message: error?.response?.data?.error || error?.message || 'Wallet authentication failed. Please try again.',
                    variant: 'error',
                });
            }
        } finally {
            setConnecting(false);
        }
    }, [router, showNotice]);

    const disconnectWallet = useCallback(() => {
        handleDisconnect();
        router.push('/');
    }, [router, handleDisconnect]);

    const value: WalletContextType = {
        account,
        isConnected: !!account,
        isAdmin,
        role: !account ? 'guest' : isAdmin ? 'admin' : 'user',
        connecting,
        hasMetaMask,
        walletName,
        connectWallet,
        disconnectWallet,
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
            {notice && (
                <div className="fixed top-4 right-4 z-[200] w-[calc(100vw-2rem)] max-w-md">
                    <div
                        className={`rounded-sm border p-4 shadow-xl backdrop-blur-sm ${notice.variant === 'error'
                                ? 'border-red-800/70 bg-red-950/90 text-red-100'
                                : 'border-blue-800/70 bg-slate-900/95 text-slate-100'
                            }`}
                        role="status"
                        aria-live="polite"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-mono uppercase tracking-wider opacity-90">
                                    {notice.title}
                                </p>
                                <p className="mt-1 text-sm leading-relaxed text-slate-200">
                                    {notice.message}
                                </p>
                            </div>
                            <button
                                onClick={clearNotice}
                                className="text-xs font-mono uppercase tracking-wider opacity-80 hover:opacity-100"
                                aria-label="Dismiss message"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </WalletContext.Provider>
    );
}
