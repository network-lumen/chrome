import { useState, useEffect } from 'react';
import { VaultManager } from '../modules/vault/vault';

interface ApprovalRequest {
    requestId: string;
    origin: string;
    permissions: string[];
    type: 'approval-request' | 'pending-unlock-request' | 'transaction-request';
    params?: any;
}

interface ApprovalModalProps {
    onClose: () => void;
}

export function ApprovalModal({ onClose }: ApprovalModalProps) {
    const [pendingRequest, setPendingRequest] = useState<ApprovalRequest | null>(null);
    const [walletAddress, setWalletAddress] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        checkPendingRequest();
    }, []);

    const checkPendingRequest = async () => {
        try {
            const result = await chrome.storage.local.get('pendingApprovalRequest');
            if (result.pendingApprovalRequest) {
                console.log('[ApprovalModal] Found pending request:', result.pendingApprovalRequest);
                setPendingRequest(result.pendingApprovalRequest as ApprovalRequest);
                await loadWalletInfo();
            } else {
                console.log('[ApprovalModal] No pending request found');
                setLoading(false);
            }
        } catch (error) {
            console.error('[ApprovalModal] Error checking pending request:', error);
            setLoading(false);
        }
    };

    const loadWalletInfo = async () => {
        try {
            const hasWallet = await VaultManager.hasWallet();
            if (!hasWallet) {
                setLoading(false);
                return;
            }

            const expired = await VaultManager.isSessionExpired();
            if (expired) {
                setIsLocked(true);
                setLoading(false);
                return;
            }

            const wallets = await VaultManager.getWallets();
            if (wallets && wallets.length > 0) {
                const activeWallet = wallets[0];
                setWalletAddress(activeWallet.address);
            }
        } catch (error) {
            console.error('[ApprovalModal] Failed to load wallet:', error);
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

        onClose();
    };

    const handleReject = () => {
        if (!pendingRequest) return;

        chrome.runtime.sendMessage({
            type: 'user-response',
            requestId: pendingRequest.requestId,
            approved: false
        });

        onClose();
    };

    const copyAddress = () => {
        navigator.clipboard.writeText(walletAddress);
    };

    // No pending request - don't show modal
    if (!loading && !pendingRequest) {
        onClose();
        return null;
    }

    // Extract domain from origin
    let displayOrigin = pendingRequest?.origin || '';
    try {
        if (pendingRequest?.origin) {
            const url = new URL(pendingRequest.origin);
            displayOrigin = url.hostname;
        }
    } catch {
        // Use origin as-is if not a valid URL
    }

    const isTransaction = pendingRequest?.type === 'transaction-request';
    const txParams = pendingRequest?.params || {};
    // Try to extract messages for display
    const msgs = txParams.msgs || txParams.messages || [];

    // Attempt to extract key info for standard Cosmos messages
    const getTransactionSummary = () => {
        if (!msgs || msgs.length === 0) return null;

        const firstMsg = msgs[0];
        const typeUrl = firstMsg.typeUrl || firstMsg.type || 'Transaction';
        // Extract value - handle both Amino (value) and Direct (encoded in value or separate) format differences slightly generally
        // For Direct, value is bytes, so we might not be able to decode easily without proto. 
        // But if it came from our dApp provider, it might be in a readable format before signing.
        const value = firstMsg.value || firstMsg;

        return {
            type: typeUrl.split('.').pop().replace('Msg', ''),
            to: value.toAddress || value.to_address || '-',
            amount: value.amount ? (
                Array.isArray(value.amount)
                    ? `${value.amount[0]?.amount} ${value.amount[0]?.denom}`
                    : `${value.amount?.amount} ${value.amount?.denom}`
            ) : '-'
        };
    };

    const txSummary = isTransaction ? getTransactionSummary() : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Dark overlay */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={handleReject}
            />

            {/* Modal content */}
            <div className="relative bg-surface rounded-2xl w-full max-w-sm mx-4 shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in duration-200">
                {loading ? (
                    <div className="p-8 flex items-center justify-center">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
                            <p className="text-sm text-gray-500">Loading...</p>
                        </div>
                    </div>
                ) : isLocked ? (
                    <div className="p-6 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-2">Wallet Locked</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Please unlock your wallet first to approve this connection.
                        </p>
                        <button
                            onClick={handleReject}
                            className="w-full py-2 px-4 bg-surfaceHighlight text-foreground rounded-lg hover:bg-surfaceHighlight/80"
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-5 border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-lg font-bold text-foreground">
                                        {isTransaction ? 'Sign Transaction' : 'Connect Request'}
                                    </h2>
                                    <p className="text-sm text-gray-500 truncate max-w-[200px]" title={displayOrigin}>
                                        {displayOrigin}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-4 max-h-72 overflow-y-auto">
                            {!isTransaction ? (
                                <>
                                    <div className="text-sm text-center text-[var(--text-dim)]">
                                        This site is requesting your permission to:
                                    </div>

                                    {/* Permissions List */}
                                    <div className="bg-surfaceHighlight rounded-xl p-4">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Permissions</h3>
                                        <ul className="space-y-2">
                                            {pendingRequest?.permissions.map((permission, index) => (
                                                <li key={index} className="flex items-center gap-2 text-sm text-foreground">
                                                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span>{permission}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    {txSummary ? (
                                        <div className="bg-surfaceHighlight/50 rounded-xl p-4 space-y-3">
                                            <div className="flex justify-between items-center pb-2 border-b border-white/5">
                                                <span className="text-xs text-[var(--text-muted)]">Type</span>
                                                <span className="text-sm font-bold text-primary">{txSummary.type}</span>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-xs text-[var(--text-muted)] block">To</span>
                                                <div className="text-xs font-mono text-foreground break-all">{txSummary.to}</div>
                                            </div>
                                            <div className="space-y-1 pt-1">
                                                <span className="text-xs text-[var(--text-muted)] block">Amount</span>
                                                <div className="text-sm font-bold text-foreground">{txSummary.amount}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-[var(--text-muted)] text-center italic">
                                            Detailed preview not available for this message type.
                                        </div>
                                    )}

                                    <div className="bg-black/20 rounded-lg p-3">
                                        <details className="text-xs">
                                            <summary className="cursor-pointer text-[var(--text-dim)] hover:text-primary transition-colors">View Raw Data</summary>
                                            <pre className="mt-2 text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap font-mono">
                                                {JSON.stringify(msgs, null, 2)}
                                            </pre>
                                        </details>
                                    </div>
                                </div>
                            )}

                            {/* Wallet Info (Only for context) */}
                            {walletAddress && (
                                <div className="bg-surfaceHighlight rounded-xl p-4">
                                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Your Wallet</h3>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 font-mono text-sm text-gray-400 truncate">
                                            {walletAddress.slice(0, 10)}...{walletAddress.slice(-6)}
                                        </div>
                                        <button
                                            onClick={copyAddress}
                                            className="p-1.5 hover:bg-surface rounded-lg transition-colors"
                                        >
                                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Warning */}
                            {!isTransaction && (
                                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg">
                                    <svg className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <p className="text-xs text-yellow-500">
                                        Only connect with sites you trust.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="p-4 pt-0 flex gap-3">
                            <button
                                onClick={handleReject}
                                className="flex-1 py-3 px-4 border border-red-500/50 text-red-400 rounded-xl font-semibold hover:bg-red-500/10 transition-colors"
                            >
                                Reject
                            </button>
                            <button
                                onClick={handleApprove}
                                className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                            >
                                {isTransaction ? 'Sign' : 'Connect'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
