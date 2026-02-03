import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { VaultManager } from '../modules/vault/vault';

interface ApprovalRequest {
    requestId: string;
    origin: string;
    permissions: string[];
    type: 'approval-request' | 'pending-unlock-request';
}

export function ApprovalPage() {
    const navigate = useNavigate();
    const [pendingRequest, setPendingRequest] = useState<ApprovalRequest | null>(null);
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [balance, setBalance] = useState<string>('0.00');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for pending approval request in storage
        const checkPendingRequest = async () => {
            try {
                const result = await chrome.storage.local.get('pendingApprovalRequest');
                if (result.pendingApprovalRequest) {
                    console.log('[ApprovalPage] Found pending request:', result.pendingApprovalRequest);
                    setPendingRequest(result.pendingApprovalRequest as ApprovalRequest);
                } else {
                    console.log('[ApprovalPage] No pending request found');
                }
            } catch (error) {
                console.error('[ApprovalPage] Error checking pending request:', error);
            }
        };

        checkPendingRequest();

        // Load wallet info
        loadWalletInfo();
    }, []);

    const loadWalletInfo = async () => {
        try {
            // Check if wallet is locked first
            const hasWallet = await VaultManager.hasWallet();
            if (!hasWallet) {
                setLoading(false);
                return;
            }

            const expired = await VaultManager.isSessionExpired();
            if (expired) {
                // Wallet is locked, don't try to load wallet info
                console.log('[ApprovalPage] Wallet is locked, waiting for unlock');
                setLoading(false);
                return;
            }

            // Wallet is unlocked, safe to load
            const wallets = await VaultManager.getWallets();
            if (wallets && wallets.length > 0) {
                const activeWallet = wallets[0];
                setWalletAddress(activeWallet.address);

                // TODO: Fetch balance from chain
                // For now, use placeholder
                setBalance('1,234.56');
            }
        } catch (error) {
            console.error('[ApprovalPage] Failed to load wallet:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = () => {
        if (!pendingRequest) return;

        chrome.runtime.sendMessage({
            type: 'user-response',
            requestId: pendingRequest.requestId,
            approved: true
        });

        // Close popup or navigate
        window.close();
    };

    const handleReject = () => {
        if (!pendingRequest) return;

        chrome.runtime.sendMessage({
            type: 'user-response',
            requestId: pendingRequest.requestId,
            approved: false
        });

        // Close popup or navigate back
        window.close();
    };

    const copyAddress = () => {
        navigator.clipboard.writeText(walletAddress);
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-sm text-gray-500">Loading wallet...</p>
                </div>
            </div>
        );
    }

    if (!pendingRequest) {
        return (
            <div className="h-full flex items-center justify-center bg-background p-6">
                <div className="text-center">
                    <p className="text-sm text-gray-500">No pending approval request</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Extract domain from origin
    let displayOrigin = pendingRequest.origin;
    try {
        const url = new URL(pendingRequest.origin);
        displayOrigin = url.hostname;
    } catch {
        // Use origin as-is if not a valid URL
    }

    return (
        <div className="h-full bg-background flex flex-col">
            {/* Header */}
            <header className="p-6 border-b border-border">
                <div className="flex items-center gap-3 mb-2">
                    {/* Simple globe icon as placeholder for favicon */}
                    <div className="w-10 h-10 rounded-full bg-surfaceHighlight flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-foreground">{displayOrigin}</h2>
                        <p className="text-sm text-gray-500">wants to connect</p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Permissions */}
                <div className="glass-card p-4 rounded-xl">
                    <h3 className="text-sm font-semibold text-foreground mb-3">This site will be able to:</h3>
                    <ul className="space-y-2">
                        {pendingRequest.permissions.map((permission, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-400">
                                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>{permission}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Wallet Info */}
                <div className="glass-card p-4 rounded-xl">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Your Wallet</h3>

                    {/* Address */}
                    <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 bg-surfaceHighlight rounded-lg px-3 py-2 font-mono text-sm text-gray-400 truncate">
                            {walletAddress.slice(0, 12)}...{walletAddress.slice(-8)}
                        </div>
                        <button
                            onClick={copyAddress}
                            className="p-2 hover:bg-surfaceHighlight rounded-lg transition-colors"
                            title="Copy address"
                        >
                            <svg className="w-5 h-5 text-gray-400 hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                    </div>

                    {/* Balance */}
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-lg font-bold text-foreground">{balance} LUMEN</span>
                    </div>
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <svg className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-xs text-yellow-500">
                        Only connect with sites you trust. Lumen Wallet will never ask for your private keys.
                    </p>
                </div>
            </main>

            {/* Actions */}
            <footer className="p-6 border-t border-border space-y-3">
                <button
                    onClick={handleReject}
                    className="w-full py-3 px-4 border-2 border-red-500 text-red-500 rounded-xl font-semibold hover:bg-red-500/10 transition-colors"
                >
                    Reject
                </button>
                <button
                    onClick={handleApprove}
                    className="w-full py-3 px-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors premium-btn"
                >
                    Approve Connection
                </button>
            </footer>
        </div>
    );
}
