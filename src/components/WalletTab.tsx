import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyManager, type LumenWallet } from '../modules/sdk/key-manager';
import { SetPassword } from './onboarding/SetPassword';
import { Welcome } from './onboarding/Welcome';
import { CreateMethod } from './onboarding/CreateMethod';
import { MnemonicDisplay } from './onboarding/MnemonicDisplay';
import { MnemonicVerify } from './onboarding/MnemonicVerify';
import { ImportWalletAdvanced } from './onboarding/ImportWalletAdvanced';
import { VaultManager } from '../modules/vault/vault';
import { ActionBar } from './dashboard/ActionBar';
import { NetworkManager } from '../modules/sdk/network';
import { ReceiveModal } from './dashboard/ReceiveModal';
import { LinkPQCBanner } from './dashboard/LinkPQCBanner';
import { HistoryModal } from './history/HistoryModal';
import { HistoryManager } from '../modules/history/history';
import {
    getAssetOwnerLabel,
    loadCrossChainAssets,
    type CrossChainAssetRow
} from '../modules/assets/crossChain';

function shouldShowRawDenom(asset: CrossChainAssetRow): boolean {
    const rawDenom = String(asset.denom || '').trim().toLowerCase();
    if (!rawDenom) return false;
    if (rawDenom.startsWith('ibc/')) return false;
    if (rawDenom === 'ulmn' || rawDenom === 'ubze' || rawDenom === 'uusdc') return false;
    return true;
}

interface WalletTabProps {
    onWalletReady: () => void;
    activeKeys: LumenWallet | null;
    isAdding?: boolean;
    onCancel?: () => void;
    showLinkModal?: boolean;
    onCloseLinkModal?: () => void;
}

export const WalletTab: React.FC<WalletTabProps> = ({ onWalletReady, activeKeys, isAdding, onCancel, showLinkModal, onCloseLinkModal }) => {
    const navigate = useNavigate();
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
    const [receiveAssetContext, setReceiveAssetContext] = useState<CrossChainAssetRow | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [copiedAddress, setCopiedAddress] = useState(false);
    const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null);
    const [assetRows, setAssetRows] = useState<CrossChainAssetRow[]>([]);
    const [assetRowsLoading, setAssetRowsLoading] = useState(false);
    const [assetRowsError, setAssetRowsError] = useState<string | null>(null);
    const assetRequestRef = React.useRef(0);

    /* Fetch Balance Effect */
    React.useEffect(() => {
        if (!activeKeys) return;

        const fetchBalance = async () => {
            try {
                const endpoint = NetworkManager.getInstance().getQuickRestEndpoint();
                const res = await fetch(`${endpoint}/cosmos/bank/v1beta1/balances/${activeKeys.address}`);

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

    const refreshAssets = React.useCallback(async (showSpinner: boolean = true) => {
        if (!activeKeys) return;

        const requestId = ++assetRequestRef.current;

        try {
            if (showSpinner) {
                setAssetRowsLoading(true);
            }

            const result = await loadCrossChainAssets(activeKeys);
            if (requestId !== assetRequestRef.current) return;

            setAssetRows(result.rows);
            setAssetRowsError(result.errors.length ? result.errors.join(' · ') : null);
        } catch (e: any) {
            if (requestId !== assetRequestRef.current) return;
            setAssetRows([]);
            setAssetRowsError(e?.message || 'Failed to load assets.');
        } finally {
            if (requestId === assetRequestRef.current) {
                setAssetRowsLoading(false);
            }
        }
    }, [activeKeys]);

    React.useEffect(() => {
        if (!activeKeys) return;

        void refreshAssets(true);
        const interval = setInterval(() => {
            void refreshAssets(false);
        }, 15000);

        return () => clearInterval(interval);
    }, [activeKeys, refreshAssets]);

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

    const importPreparedWallet = async (buildWallet: () => Promise<LumenWallet>) => {
        try {
            setIsImporting(true);
            setError(null);

            if (isAdding) {
                try {
                    await VaultManager.getWallets();
                } catch (e: any) {
                    setError("Session expired or vault locked. Please unlock and try again.");
                    return;
                }
            }

            const keys = await buildWallet();
            setTempWallet(keys);

            if (isAdding) {
                const existing = await VaultManager.getWallets();
                if (existing.some(w => w.address === keys.address)) {
                    setError("Wallet already exists in your vault.");
                    return;
                }

                const newWallets = [...existing, keys];
                await VaultManager.saveWallets(newWallets);
                onWalletReady();
                return;
            }

            setView('set-password');
        } catch (e: any) {
            setError(e.message || 'Import failed');
        } finally {
            setIsImporting(false);
        }
    };

    /* --- VIEWS --- */

    /* 1. Authenticated Dashboard (Balance) - PRIORITY */
    if (activeKeys) {
        return (
            <div className="h-full overflow-y-auto space-y-6 animate-slide-up relative pb-24">
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
                    onReceive={() => {
                        setReceiveAssetContext(null);
                        setShowReceive(true);
                    }}
                    onHistory={() => setShowHistory(true)}
                />

                <section className="px-4 pb-2 space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-foreground">Assets Across Chains</h3>
                            <p className="text-[11px] text-[var(--text-muted)]">See what you hold on Lumen and linked IBC chains.</p>
                        </div>
                        <button
                            onClick={() => void refreshAssets(true)}
                            className="text-[10px] font-bold text-primary hover:text-primary-hover transition-colors"
                        >
                            {assetRowsLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>

                    {assetRowsError && (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
                            <p className="text-[11px] text-amber-300 leading-relaxed">{assetRowsError}</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {assetRows
                            .filter((asset) => !(asset.isLocal && asset.denom === 'ulmn'))
                            .map((asset) => (
                            <div key={asset.id} className="rounded-2xl border border-border bg-surface p-4 space-y-3">
                                <div className="space-y-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-foreground">{asset.displayName}</p>
                                            {asset.chainLabel.trim().toLowerCase() !== asset.displayName.trim().toLowerCase() && (
                                                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                                                    {asset.chainLabel}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex items-center justify-between gap-3">
                                            <p className="text-[11px] text-[var(--text-muted)]">{getAssetOwnerLabel(asset)}</p>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(asset.ownerAddress);
                                                    setCopiedAssetId(asset.id);
                                                    setTimeout(() => {
                                                        setCopiedAssetId((current) => current === asset.id ? null : current);
                                                    }, 2000);
                                                }}
                                                className={`shrink-0 p-2 rounded-lg transition-all active:scale-90 border border-border/50 ${copiedAssetId === asset.id
                                                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/20 border-green-500'
                                                    : 'bg-surface text-foreground/40 hover:text-primary hover:shadow-lg'
                                                    }`}
                                                aria-label="Copy address"
                                                title="Copy address"
                                            >
                                                {copiedAssetId === asset.id ? (
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
                                    {shouldShowRawDenom(asset) && (
                                        <p className="text-[11px] break-all text-[var(--text-muted)]">{asset.denom}</p>
                                    )}
                                </div>

                                <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Balance</p>
                                    <div className="mt-1 flex items-end gap-2">
                                        <p className="text-2xl font-black text-foreground leading-none">{asset.displayAmount}</p>
                                        <p className="text-sm font-bold text-primary/80">{asset.displaySymbol}</p>
                                    </div>
                                </div>

                                {!!asset.error && (
                                    <div className="space-y-1">
                                        <p className="text-[11px] text-amber-300">{asset.error}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => {
                                            setReceiveAssetContext(asset);
                                            setShowReceive(true);
                                        }}
                                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-surfaceHighlight"
                                    >
                                        Receive
                                    </button>
                                    <button
                                        onClick={() => navigate('/send', {
                                            state: {
                                                assetContext: asset,
                                                initialMode: 'same-chain'
                                            }
                                        })}
                                        disabled={!asset.sendEnabled}
                                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-surfaceHighlight disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {showReceive && (
                    <ReceiveModal
                        address={receiveAssetContext?.ownerAddress || activeKeys.address}
                        title={receiveAssetContext ? `Receive On ${receiveAssetContext.chainLabel}` : 'Receive Assets'}
                        helperText={
                            receiveAssetContext
                                ? `Only send ${receiveAssetContext.chainLabel} assets to this address.`
                                : 'Only send Lumen (LMN) assets to this address.'
                        }
                        onClose={() => {
                            setShowReceive(false);
                            setReceiveAssetContext(null);
                        }}
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
                onImport={(mnemonic, pqcKey) => importPreparedWallet(() => KeyManager.importWallet(mnemonic, pqcKey))}
                onGenerateFreshPqc={(mnemonic) => importPreparedWallet(() => KeyManager.recoverFromMnemonic(mnemonic))}
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
