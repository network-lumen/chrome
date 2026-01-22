import React, { useState } from 'react';
import { KeyManager, type LumenWallet } from '../modules/sdk/key-manager';
import { SetPassword } from './onboarding/SetPassword';
import { Welcome } from './onboarding/Welcome';
import { CreateMethod } from './onboarding/CreateMethod';
import { MnemonicDisplay } from './onboarding/MnemonicDisplay';
import { MnemonicVerify } from './onboarding/MnemonicVerify';
import { ImportWalletAdvanced } from './onboarding/ImportWalletAdvanced';
import { VaultManager } from '../modules/vault/vault';
import { ActionBar } from './dashboard/ActionBar';
import { ReceiveModal } from './dashboard/ReceiveModal';
import { LinkPQCBanner } from './dashboard/LinkPQCBanner';
import { HistoryModal } from './history/HistoryModal';
import { HistoryManager } from '../modules/history/history';

interface WalletTabProps {
    onWalletReady: () => void;
    activeKeys: LumenWallet | null;
    isAdding?: boolean;
    onCancel?: () => void;
    showLinkModal?: boolean;
    onCloseLinkModal?: () => void;
}

export const WalletTab: React.FC<WalletTabProps> = ({ onWalletReady, activeKeys, isAdding, onCancel, showLinkModal, onCloseLinkModal }) => {
    /* Flows: 'welcome' -> 'create-method' -> 'mnemonic-display' -> 'mnemonic-verify' -> 'set-password' -> DONE */
    /* Or: 'welcome' -> 'import' -> 'set-password' -> DONE */
    const [view, setView] = useState<'welcome' | 'create-method' | 'mnemonic-display' | 'mnemonic-verify' | 'import' | 'set-password'>(isAdding ? 'create-method' : 'welcome');

    const [_isLoading, setIsLoading] = React.useState(false);
    const lastBalanceRef = React.useRef<string>("0");
    const [_error, setError] = useState<string | null>(null);

    /* Generation State */
    const [tempWallet, setTempWallet] = useState<LumenWallet | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    /* Balance State */
    const [balance, setBalance] = useState<string>('0.00');
    const [hideBalance, setHideBalance] = useState(() => localStorage.getItem('hideBalance') === 'true');

    /* Toggle Balance Visibility */
    const toggleBalance = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent parent clicks
        const newState = !hideBalance;
        setHideBalance(newState);
        localStorage.setItem('hideBalance', String(newState));
    };

    /* UI State */
    const [showReceive, setShowReceive] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [copiedAddress, setCopiedAddress] = useState(false);

    /* Fetch Balance Effect */
    React.useEffect(() => {
        if (!activeKeys) return;

        const fetchBalance = async () => {
            try {
                /* TODO: Move API config to a central place */
                const API_URL = "https://api-lumen.winnode.xyz";
                const res = await fetch(`${API_URL}/cosmos/bank/v1beta1/balances/${activeKeys.address}`);

                if (!res.ok) throw new Error("Failed to fetch balance");

                if (res.ok) {
                    const data = await res.json();
                    const newBalRaw = data.balances.find((b: any) => b.denom === 'ulmn')?.amount || '0';
                    const newBalFormatted = (parseFloat(newBalRaw) / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
                    setBalance(newBalFormatted);

                    // Check for increase -> Force Scan
                    const oldBalVal = parseFloat(lastBalanceRef.current);
                    const newBalVal = parseFloat(newBalRaw);
                    if (newBalVal > oldBalVal && oldBalVal > 0) {
                        HistoryManager.onBalanceIncrease(activeKeys.address);
                    }
                    lastBalanceRef.current = newBalRaw;
                }
            } catch (e) {
                console.warn("Balance fetch failed (transient):", e);
                /* Keep previous/default balance on error or show indicator */
            }
        };

        fetchBalance();

        /* Poll every 10 seconds */
        const interval = setInterval(fetchBalance, 10000);
        return () => clearInterval(interval);
    }, [activeKeys]);

    /* Active Block Scanner Polling (Every 6s) */
    React.useEffect(() => {
        if (!activeKeys?.address) return;

        // Run once on mount/change
        const sync = () => {
            HistoryManager.syncGap(activeKeys.address); // Fast Sync for Offline Gap
            HistoryManager.syncBlocks(activeKeys.address);
        };
        sync();

    }, [activeKeys]);

    const handleAddToVault = async () => {
        if (!tempWallet) return;
        try {
            setIsLoading(true);
            /* Get existing, append, save */
            const existing = await VaultManager.getWallets();
            /* Check for dupe address */
            if (existing.some(w => w.address === tempWallet.address)) {
                alert("Wallet already exists!");
                setIsLoading(false);
                return;
            }

            const newWallets = [...existing, tempWallet];
            await VaultManager.saveWallets(newWallets);
            onWalletReady();
        } catch (e: any) {
            console.error(e);
            const msg = e.message === 'Session expired.'
                ? "Wallet is locked. Please unlock your wallet in the extension popup first before adding a new one."
                : "Failed to add wallet: " + e.message;
            setError(msg);
            setIsLoading(false);
        }
    };

    const handleSetPassword = async (password: string) => {
        if (!tempWallet) return;
        try {
            setIsLoading(true);

            /* Safety Guard: Check if a vault already exists on disk */
            const exists = await VaultManager.hasWallet();
            if (exists) {
                setError("A wallet already exists on this device. Please unlock it and use 'Add Wallet' instead of creating a new vault.");
                setIsLoading(false);
                return;
            }

            /* Initial setup -> Just array of one */
            await VaultManager.lock([tempWallet], password);
            onWalletReady();
        } catch (e) {
            console.error(e);
            setError("Failed to encrypt wallet.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleWalletUpdate = async (updated: LumenWallet) => {
        try {
            const existing = await VaultManager.getWallets();
            const index = existing.findIndex(w => w.address === updated.address);
            if (index === -1) return;

            existing[index] = { ...existing[index], ...updated };
            await VaultManager.saveWallets(existing);
            onWalletReady(); // Trigger reload
        } catch (e) {
            console.error("Failed to update wallet in vault:", e);
        }
    };

    const handleGenerate = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const keys = await KeyManager.createWallet();

            setTempWallet(keys);
            setView('mnemonic-display');
        } catch (e: any) {
            setError(e.message || 'Generation failed');
        } finally {
            setIsLoading(false);
        }
    };

    /* --- VIEWS --- */

    /* 1. Authenticated Dashboard (Balance) - PRIORITY */
    if (activeKeys) {
        return (
            <div className="space-y-6 animate-slide-up relative">
                {/* PQC Link Modal */}
                {showLinkModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="w-full max-w-sm bg-surface border border-border rounded-xl relative">
                            {/* Close Button */}
                            <button
                                onClick={onCloseLinkModal}
                                className="absolute top-2 right-2 p-1 text-[var(--text-muted)] hover:text-foreground rounded-full hover:bg-white/5 transition-colors z-10"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>

                            <div className="p-4 pt-8">
                                <LinkPQCBanner wallet={activeKeys} onWalletUpdate={handleWalletUpdate} isModal={true} />
                            </div>
                        </div>
                    </div>
                )}

                {/* REMOVED INLINE BANNER - Now using Modal */}

                <div className="relative mt-2 px-1">
                    {/* Premium Balance Card */}
                    <div className="premium-card rounded-3xl p-6 transition-all duration-700 group/balance">
                        {/* Mesh Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-lumen/5 opacity-50 group-hover/balance:opacity-100 transition-opacity duration-700" />

                        <div className="relative z-10">
                            {/* Header Row */}
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                                    <span className="text-[10px] font-bold text-foreground/40 tracking-[0.2em] uppercase">Total Balance</span>
                                    <button
                                        onClick={toggleBalance}
                                        className="p-1.5 text-foreground/20 hover:text-foreground transition-all rounded-lg hover:bg-foreground/5"
                                    >
                                        {hideBalance ? (
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        ) : (
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                        )}
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20 backdrop-blur-md">
                                    <div className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,1)] animate-pulse" />
                                    <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Secured</span>
                                </div>
                            </div>

                            {/* Balance Display */}
                            <div className="mb-8">
                                <div className="flex items-baseline gap-2.5 mb-1.5">
                                    <span className="text-5xl font-black text-foreground tracking-tight leading-none">
                                        {hideBalance ? '••••••' : balance.split('.')[0]}
                                    </span>
                                    {!hideBalance && (
                                        <span className="text-3xl font-bold text-foreground/40 tabular-nums">.{balance.split('.')[1] || '00'}</span>
                                    )}
                                    <span className="text-base font-black text-primary/50 tracking-tighter ml-1">LMN</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-[1px] w-8 bg-foreground/10" />
                                    <span className="text-[11px] font-bold text-foreground/30 font-mono tracking-tight">≈ $0.00 USD</span>
                                </div>
                            </div>

                            {/* Address Box */}
                            <div className="relative group/address">
                                <div className="absolute inset-0 bg-foreground/5 rounded-xl blur-xl opacity-0 group-hover/address:opacity-100 transition-opacity" />
                                <div className="relative bg-foreground/5 rounded-xl p-3.5 flex items-center justify-between hover:bg-foreground/10 transition-colors">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="text-[8px] font-black text-foreground/30 mb-1 uppercase tracking-[0.2em]">Address</div>
                                        <div className="font-mono text-[10px] text-foreground/60 leading-relaxed tracking-tight break-all">
                                            {activeKeys.address.substring(0, 24)}
                                            <wbr />
                                            {activeKeys.address.substring(24)}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(activeKeys.address);
                                            setCopiedAddress(true);
                                            setTimeout(() => setCopiedAddress(false), 2000);
                                        }}
                                        className={`p-2.5 rounded-lg transition-all active:scale-90 border border-border/50 ${copiedAddress
                                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/20 border-green-500'
                                            : 'bg-surface text-foreground/40 hover:text-primary hover:shadow-lg'
                                            }`}
                                    >
                                        {copiedAddress ? (
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Identity Info Hidden */}

                <ActionBar
                    onReceive={() => setShowReceive(true)}
                    onHistory={() => setShowHistory(true)}
                />

                {showReceive && (
                    <ReceiveModal
                        address={activeKeys.address}
                        onClose={() => setShowReceive(false)}
                    />
                )}

                {showHistory && (
                    <HistoryModal
                        address={activeKeys.address}
                        onClose={() => setShowHistory(false)}
                    />
                )}
            </div>
        );
    }

    /* 0. Welcome Screen (First Time Only) */
    if (view === 'welcome') {
        return (
            <Welcome
                onCreateNew={() => setView('create-method')}
                onImportExisting={() => setView('import')}
                onBack={onCancel}
            />
        );
    }

    /* 1. Create Method Selection */
    if (view === 'create-method') {
        return (
            <CreateMethod
                onSelectMnemonic={handleGenerate}
                onSelectImport={() => setView('import')}
                onBack={() => setView('welcome')}
            />
        );
    }

    /* 2. Mnemonic Display (after generation) */
    if (view === 'mnemonic-display' && tempWallet) {
        return (
            <MnemonicDisplay
                mnemonic={tempWallet.mnemonic}
                pqcKey={tempWallet.pqcKey}
                address={tempWallet.address}
                onConfirm={() => setView('mnemonic-verify')}
                onBack={() => setView('create-method')}
            />
        );
    }

    /* 3. Mnemonic Verification */
    if (view === 'mnemonic-verify' && tempWallet) {
        return (
            <MnemonicVerify
                mnemonic={tempWallet.mnemonic}
                onVerified={() => {
                    if (isAdding) {
                        handleAddToVault();
                    } else {
                        setView('set-password');
                    }
                }}
                onBack={() => setView('mnemonic-display')}
            />
        );
    }

    /* 4. Import Wallet */
    if (view === 'import') {
        return (
            <ImportWalletAdvanced
                onImport={async (mnemonic, pqcKey) => {
                    try {
                        setIsImporting(true);
                        setError(null);

                        // If adding, ensure session is still valid
                        if (isAdding) {
                            try {
                                await VaultManager.getWallets();
                            } catch (e: any) {
                                setError("Session expired or vault locked. Please unlock and try again.");
                                setIsImporting(false);
                                return;
                            }
                        }

                        const keys = await KeyManager.importWallet(mnemonic, pqcKey);
                        setTempWallet(keys);

                        if (isAdding) {
                            const existing = await VaultManager.getWallets();
                            if (existing.some(w => w.address === keys.address)) {
                                setError("Wallet already exists in your vault.");
                                setIsImporting(false);
                                return;
                            }
                            const newWallets = [...existing, keys];
                            await VaultManager.saveWallets(newWallets);
                            onWalletReady();
                        } else {
                            setView('set-password');
                        }
                    } catch (e: any) {
                        setError(e.message || 'Import failed');
                    } finally {
                        setIsImporting(false);
                    }
                }}
                onBack={() => setView(isAdding ? 'create-method' : 'welcome')}
                isLoading={isImporting}
                error={_error}
            />
        );
    }

    /* 5. Set Password */
    if (view === 'set-password') {
        return <SetPassword onConfirm={handleSetPassword} />;
    }

    /* Fallback - should not reach here */
    return null;
};
