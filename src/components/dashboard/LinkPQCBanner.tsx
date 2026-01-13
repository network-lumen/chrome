import React, { useState, useEffect } from 'react';
import type { LumenWallet } from '../../modules/sdk/key-manager';
import {
    getLinkRequirements,
    checkBalance,
    computeLinkPowNonce,
    linkPqcAccount,
    checkPqcAccountStatus
} from '../../modules/sdk/link-pqc';

type LinkState = 'checking' | 'ready' | 'computing' | 'broadcasting' | 'success' | 'error' | 'hidden';

interface LinkPQCBannerProps {
    wallet?: LumenWallet | null;
    onWalletUpdate?: (wallet: LumenWallet) => void;
    isModal?: boolean;
}

export const LinkPQCBanner: React.FC<LinkPQCBannerProps> = ({ wallet, onWalletUpdate, isModal }) => {
    /* Determine initial state: if wallet exists and says linked, hide immediately */
    const [linkState, setLinkState] = useState<LinkState>(
        (!isModal && (!wallet || wallet.linked || wallet.linkTxHash)) ? 'hidden' : 'checking'
    );
    const [error, setError] = useState<string>('');
    const [progress, setProgress] = useState<number>(0);
    const [requirements, setRequirements] = useState({ minBalance: '1000', powBits: 21 });
    const [isActionStarting, setIsActionStarting] = useState(false);

    /* Transaction Verification State */
    const [txHash, setTxHash] = useState<string | null>(null);
    const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'verified' | 'failed'>('idle');
    const [verificationMessage, setVerificationMessage] = useState<string>('');

    /* Reset state when wallet changes */
    useEffect(() => {
        /* When wallet address changes, re-evaluate the initial state logic */
        /* This ensures the banner doesn't flash if the new wallet is already linked or doesn't need linking. */
        setLinkState((!isModal && (!wallet || wallet.linked || wallet.linkTxHash)) ? 'hidden' : 'checking');
        setError('');
    }, [wallet?.address, wallet?.linked, wallet?.linkTxHash, isModal]); /* Depend on linked/linkTxHash as well for immediate re-evaluation */

    /* Check if linking is needed */
    useEffect(() => {
        /* 1. Immediate Short-circuit */
        if (wallet?.linked) {
            setLinkState(isModal ? 'success' : 'hidden');
            return;
        }

        const controller = new AbortController();

        async function checkLinkStatus() {
            /* ONLY proceed if we are in 'checking' state. */
            /* This prevents background refreshes from overriding 'computing' or 'broadcasting' states. */
            if (linkState !== 'checking' && linkState !== 'hidden') {
                return;
            }

            if (!wallet) {
                if (!controller.signal.aborted) setLinkState(isModal ? 'error' : 'hidden');
                return;
            }

            /* Get requirements */
            let reqs;
            try {
                reqs = await getLinkRequirements();
                if (controller.signal.aborted) return;
                setRequirements({ minBalance: reqs.minBalance, powBits: reqs.powDifficultyBits });
            } catch (e) {
                if (controller.signal.aborted) return;
            }

            /* Check balance */
            // @ts-ignore
            const hasBalance = await checkBalance(wallet.address, reqs?.minBalance || '1000');
            if (controller.signal.aborted) return;

            if (!hasBalance) {
                if (isModal) {
                    setError(`Insufficient balance. Linking requires ${parseInt(reqs?.minBalance || '1000') / 1000000} LMN.`);
                    setLinkState('error');
                } else {
                    setLinkState('hidden'); /* Don't show banner if insufficient balance */
                }
                return;
            }

            /* Check if already linked on-chain (user might have linked via CLI) */
            const status = await checkPqcAccountStatus(wallet.address);
            if (controller.signal.aborted) return;

            if (status.isLinked) {
                if (onWalletUpdate) {
                    try {
                        /* Update local state */
                        onWalletUpdate({
                            ...wallet,
                            linked: true,
                            linkedAt: new Date().toISOString(),
                            /* Also persist the public key if found on chain (recovers lost keys) */
                            ...(status.pqcPublicKey ? {
                                pqcKey: {
                                    ...wallet.pqcKey,
                                    publicKey: status.pqcPublicKey
                                }
                            } : {})
                        });
                    } catch (e) {
                        console.error('[LinkPQCBanner] Failed to persist linked status:', e);
                    }
                }
                setLinkState(isModal ? 'success' : 'hidden');
                return;
            }

            setLinkState('ready');
        }

        checkLinkStatus();

        return () => controller.abort();
    }, [wallet, onWalletUpdate]);

    const handleLink = async () => {
        if (!wallet) return;

        try {
            setError('');
            setTxHash(null);
            setVerificationStatus('idle');
            setIsActionStarting(true);
            setLinkState('computing');
            /* ... (rest of handleLink start) */

            setTimeout(async () => {
                try {
                    setIsActionStarting(false);
                    /* Get pqcKey, supporting both new and legacy structures. */
                    /* Cast to any to handle both snake_case and camelCase for resilience */
                    const pqcData = ((wallet.pqcKey as any)?.publicKey || (wallet.pqcKey as any)?.public_key)
                        ? wallet.pqcKey
                        : ((wallet as any).pqc?.publicKey || (wallet as any).pqc?.public_key)
                            ? (wallet as any).pqc
                            : (wallet.pqcKey || (wallet as any).pqc);

                    if (!pqcData || (!(pqcData as any).publicKey && !(pqcData as any).public_key)) {
                        throw new Error('PQC public key not found in wallet. Please re-import.');
                    }

                    const rawPubKey = (pqcData as any).publicKey || (pqcData as any).public_key;

                    const nonce = await computeLinkPowNonce(
                        rawPubKey,
                        requirements.powBits,
                        (hashCount) => {
                            const estimated = Math.min(95, (hashCount / 100000) * 100);
                            setProgress(estimated);
                        }
                    );

                    setProgress(100);

                    /* Step 2: Broadcast link transaction */
                    setLinkState('broadcasting');
                    const result = await linkPqcAccount(wallet, nonce);

                    if (!result.success) {
                        throw new Error(result.error || 'Link transaction failed');
                    }

                    /* Step 3: Update wallet state */
                    const newTxHash = result.txHash || '';
                    setTxHash(newTxHash);

                    if (onWalletUpdate) {
                        onWalletUpdate({
                            ...wallet,
                            linked: true,
                            linkedAt: new Date().toISOString(),
                            linkTxHash: newTxHash
                        });
                    }

                    setLinkState('success');
                    setVerificationStatus('verifying');

                    /* Verify Transaction */
                    try {
                        const API_BASE = "https://api-lumen.winnode.xyz";
                        /* Wait a simplified 2s for propagation before checking */
                        await new Promise(r => setTimeout(r, 2000));

                        const res = await fetch(`${API_BASE}/api/transaction?chain=lumen&hash=${newTxHash}`);
                        if (res.ok) {
                            const data = await res.json();

                            if (data.rawLog) {
                                setVerificationMessage(data.rawLog);
                            }

                            /* Check for explicit failure in API response */
                            if (data.success === false || (data.code !== undefined && data.code !== 0)) {
                                setVerificationStatus('failed');
                            } else {
                                setVerificationStatus('verified');
                            }
                        } else {
                            /* If immediate check fails, it might just be slow indexing */
                            setVerificationStatus('failed'); /* or 'pending' */
                        }
                    } catch (e) {
                        console.error("Verification fetch failed", e);
                        setVerificationStatus('failed');
                    }

                    /* Delayed hide disabled for now to let user see the success/hash */
                    /* setTimeout(() => setLinkState('hidden'), 5000);  */
                } catch (innerErr: any) {
                    /* ... (error handling) */
                }
            }, 100);

        } catch (err: any) {
            /* ... (error handling) */
        }
    };

    if (linkState === 'hidden') return null;

    return (
        <div className="mb-4 p-4 rounded-lg border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
            {/* Checking State */}
            {linkState === 'checking' && (
                <div className="flex flex-col items-center justify-center py-4 text-center space-y-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-[var(--text-muted)]">Verifying account status...</p>
                </div>
            )}

            {/* Ready State */}
            {linkState === 'ready' && (
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="font-bold text-yellow-900 dark:text-yellow-100 mb-1">
                            🔗 Link Your PQC Account
                        </h3>
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                            To enable dual-signed transactions, you need to register your PQC public key on-chain.
                            This is a one-time setup that requires computing a proof-of-work (may take 10-30 seconds).
                        </p>
                    </div>
                    <button
                        onClick={handleLink}
                        disabled={isActionStarting || linkState !== 'ready'}
                        className="ml-4 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center min-w-[100px]"
                    >
                        {isActionStarting ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            'Link Now'
                        )}
                    </button>
                </div>
            )}

            {/* Computing State */}
            {linkState === 'computing' && (
                <div>
                    <h3 className="font-bold text-yellow-900 dark:text-yellow-100 mb-2">
                        ⚙️ Computing Proof-of-Work...
                    </h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                        Please wait while we compute the required nonce. This may take a moment.
                    </p>
                    <div className="w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-2">
                        <div
                            className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        Progress: {Math.round(progress)}%
                    </p>
                </div>
            )}

            {/* Broadcasting State */}
            {linkState === 'broadcasting' && (
                <div>
                    <h3 className="font-bold text-yellow-900 dark:text-yellow-100 mb-2">
                        📡 Broadcasting Transaction...
                    </h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Linking your PQC account on-chain. Please wait...
                    </p>
                </div>
            )}

            {/* Success State */}
            {linkState === 'success' && (
                <div>
                    <h3 className="font-bold text-green-900 dark:text-green-100 mb-1 flex items-center gap-2">
                        ✅ PQC Account Linked!
                    </h3>
                    <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                        Your PQC key is now registered.
                    </p>

                    {txHash && (
                        <div className="bg-white/50 dark:bg-black/20 p-2 rounded text-xs font-mono mb-2 break-all">
                            <span className="font-bold block text-[10px] text-green-700 dark:text-green-300 uppercase opacity-70">Transaction Hash</span>
                            {txHash}
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-xs font-medium">
                            {verificationStatus === 'verifying' && (
                                <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    Verifying on chain...
                                </span>
                            )}
                            {verificationStatus === 'verified' && (
                                <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Confirmed Indexed
                                </span>
                            )}
                            {verificationStatus === 'failed' && (
                                <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Transaction Status: {verificationMessage ? 'Failed/Warning' : 'Pending Indexing'}
                                </span>
                            )}
                        </div>

                        {verificationMessage && (
                            <div className={`p-2 rounded text-[10px] font-mono border ${verificationStatus === 'failed' ? 'bg-orange-100 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                <span className="font-bold opacity-70 block mb-0.5">Log:</span>
                                {verificationMessage}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setLinkState('hidden')}
                        className="mt-3 w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                        Done
                    </button>
                </div>
            )}

            {/* Error State */}
            {linkState === 'error' && (
                <div>
                    <h3 className="font-bold text-red-900 dark:text-red-100 mb-1">
                        ❌ Linking Failed
                    </h3>
                    <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                        {error}
                    </p>
                    <button
                        onClick={handleLink}
                        disabled={isActionStarting || linkState !== 'error'}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center min-w-[80px]"
                    >
                        {isActionStarting ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            'Retry'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};
