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

const PqcShield = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-lumen" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.375c0 4.342 2.175 7.63 5.352 9.687A13.882 13.882 0 0012 21.75a13.882 13.882 0 004.398-2.688c3.177-2.057 5.352-5.345 5.352-9.687a12.74 12.74 0 00-.635-3.61.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
    </svg>
);

export const WalletTab: React.FC<WalletTabProps> = ({ onWalletReady, activeKeys, isAdding, showLinkModal, onCloseLinkModal }) => {
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
                console.error("Balance fetch error:", e);
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
            setError("Failed to add wallet: " + e.message);
            setIsLoading(false);
        }
    };

    const handleSetPassword = async (password: string) => {
        if (!tempWallet) return;
        try {
            setIsLoading(true);
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

                <div className="relative overflow-hidden">
                    {/* Clean Modern Balance Card */}
                    <div className="relative bg-gradient-to-br from-surface to-surfaceHighlight border border-border rounded-2xl p-6 overflow-hidden">
                        <div className="relative z-10">
                            {/* Header Row */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-foreground/70">Total Balance</span>
                                    <button
                                        onClick={toggleBalance}
                                        className="p-1.5 text-foreground/50 hover:text-foreground transition-colors rounded-lg hover:bg-surfaceHighlight"
                                    >
                                        {hideBalance ? (
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                        )}
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 bg-lumen/10 px-2.5 py-1 rounded-full border border-lumen/20">
                                    <PqcShield />
                                    <span className="text-[10px] font-bold text-lumen uppercase tracking-wide">Secured</span>
                                </div>
                            </div>
                            
                            {/* Balance Display */}
                            <div className="mb-6">
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-4xl font-bold text-foreground tracking-tight">
                                        {hideBalance ? '••••••' : balance}
                                    </span>
                                    <span className="text-lg font-medium text-foreground/50">LMN</span>
                                </div>
                                <div className="text-sm text-foreground/40">≈ $0.00 USD</div>
                            </div>
                            
                            {/* Address Section */}
                            <div className="bg-background rounded-xl p-3 border border-border">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[10px] text-foreground/40 mb-1 uppercase tracking-wider font-medium">Address</div>
                                        <div className="font-mono text-xs text-foreground/70 truncate">{activeKeys.address}</div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(activeKeys.address);
                                        }}
                                        className="ml-2 p-2 hover:bg-surfaceHighlight rounded-lg transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
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
