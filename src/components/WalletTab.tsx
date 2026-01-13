import React, { useState } from 'react';
import { Buffer } from 'buffer';
import { KeyManager, type LumenWallet, type PqcKeyData } from '../modules/sdk/key-manager';
import { SetPassword } from './onboarding/SetPassword';
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

export const WalletTab: React.FC<WalletTabProps> = ({ onWalletReady, activeKeys, isAdding, onCancel, showLinkModal, onCloseLinkModal }) => {
    /* Flows: 'init' -> 'generated' (backup) -> 'verify-mnemonic' -> 'set-password' -> DONE */
    const [view, setView] = useState<'init' | 'generated' | 'verify-mnemonic' | 'set-password'>('init');

    /* Verification State */
    const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
    const [verifyGuesses, setVerifyGuesses] = useState<string[]>(['', '', '']);

    /* Form States */
    const [mnemonicInput, setMnemonicInput] = useState('');
    const [pqcKeyFile, setPqcKeyFile] = useState<PqcKeyData | null>(null);
    const [importMode, setImportMode] = useState<'file' | 'code'>('file');
    const [pqcCodeInput, setPqcCodeInput] = useState('');

    const [isLoading, setIsLoading] = React.useState(false);
    const lastBalanceRef = React.useRef<string>("0");
    const [error, setError] = useState<string | null>(null);

    /* Generation State */
    const [hasDownloaded, setHasDownloaded] = useState(false);
    const [tempWallet, setTempWallet] = useState<LumenWallet | null>(null);

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

    const downloadFile = (data: string, filename: string) => {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setHasDownloaded(true);
    };

    const parsePqcJson = (jsonString: string): any => {
        try {
            /* Sanitize */
            const sanitized = jsonString.replace(/\u00A0/g, ' ').trim();
            const json = JSON.parse(sanitized);

            /* Handle valid nested structure if user pastes full export */
            if (json.pqc && json.pqc.scheme) {
                return json.pqc;
            }

            return json;
        } catch (e: any) {
            throw new Error(e.message);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = parsePqcJson(e.target?.result as string);
                    setPqcKeyFile(data);
                    setError(null);
                } catch (err) {
                    setError("Invalid PQC JSON: " + (err as Error).message);
                    setPqcKeyFile(null);
                }
            };
            reader.readAsText(file);
        }
    };

    const [jsonError, setJsonError] = useState<string | null>(null);

    const handleCodePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setPqcCodeInput(val);
        setJsonError(null); /* Clear previous specific error */

        if (!val.trim()) {
            setPqcKeyFile(null);
            return;
        }

        try {
            const data = parsePqcJson(val);
            setPqcKeyFile(data);
            setError(null);
        } catch (err: any) {
            setPqcKeyFile(null);
            /* setJsonError to show below the box */
            setJsonError(err.message);
        }
    };

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

    const handleImport = async () => {
        try {
            setIsLoading(true);
            setError(null);

            if (!mnemonicInput.trim()) throw new Error("Mnemonic is required.");
            if (!pqcKeyFile) throw new Error("PQC Key Data is required.");

            const keys = await KeyManager.importWallet(mnemonicInput.trim(), pqcKeyFile);
            setTempWallet(keys);

            if (isAdding) {
                /*
                 * Determine if we need to check dupes - handleAddToVault does it.
                 * But we need to set tempWallet state first.
                 * For Import, we don't need backup flow, so go straight to add
                 * BUT we can't call handleAddToVault immediately relying on state update which is async.
                 * So we pass keys directly
                 */

                const existing = await VaultManager.getWallets();
                if (existing.some(w => w.address === keys.address)) {
                    setError("Wallet already exists in your vault.");
                    setIsLoading(false); // Ensure loading state is reset
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
            setHasDownloaded(false);
            const keys = await KeyManager.createWallet();

            setTempWallet(keys);
            setView('generated');
        } catch (e: any) {
            setError(e.message || 'Generation failed');
        } finally {
            setIsLoading(false);
        }
    };

    const confirmBackup = () => {
        if (!hasDownloaded) {
            alert("Please DOWNLOAD the PQC Key File first. It is mandatory.");
            return;
        }
        if (!confirm("Have you securely saved both your Mnemonic and the JSON file? Losing either means losing your funds.")) {
            return;
        }

        if (!tempWallet) return;
        // Start Verification
        const words = tempWallet.mnemonic.split(' ');
        const indices: number[] = [];
        while (indices.length < 3) {
            const r = Math.floor(Math.random() * words.length);
            if (!indices.includes(r)) indices.push(r);
        }
        indices.sort((a, b) => a - b);

        setVerifyIndices(indices);
        setVerifyGuesses(['', '', '']);
        setView('verify-mnemonic');
    };

    const handleVerifyKeys = () => {
        if (!tempWallet) return;
        const words = tempWallet.mnemonic.split(' ');

        // Check guesses
        for (let i = 0; i < 3; i++) {
            const idx = verifyIndices[i];
            if (verifyGuesses[i].trim().toLowerCase() !== words[idx].toLowerCase()) {
                setError(`Word #${idx + 1} is incorrect.`);
                return;
            }
        }

        setError(null);

        if (isAdding) {
            handleAddToVault();
        } else {
            setView('set-password');
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
                        <div className="w-full max-w-sm bg-surface border border-border rounded-xl shadow-2xl relative">
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

                <div className="bg-gradient-to-br from-surface to-background border border-border rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-50"><div className="w-24 h-24 bg-primary rounded-full blur-[60px]"></div></div>
                    <div className="relative z-1">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[var(--text-muted)] text-xs font-medium tracking-wider uppercase">Current Balance</span>
                                <button
                                    onClick={toggleBalance}
                                    className="p-1 text-[var(--text-muted)] hover:text-foreground transition-colors rounded-md hover:bg-white/5"
                                    title={hideBalance ? "Show Balance" : "Hide Balance"}
                                >
                                    {hideBalance ? (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    )}
                                </button>
                            </div>
                            <div className="flex items-center gap-1.5 bg-surfaceHighlight/50 px-2 py-1 rounded-full border border-border backdrop-blur-md">
                                <PqcShield />
                                <span className="text-[10px] font-bold text-lumen uppercase tracking-wide">PQC Secure</span>
                            </div>
                        </div>
                        <div className="text-4xl font-bold text-foreground mb-6 font-mono tracking-tighter flex items-baseline">
                            {hideBalance ? (
                                <span className="tracking-widest">********</span>
                            ) : (
                                balance
                            )}
                            <span className="text-lg text-[var(--text-muted)] font-sans font-normal ml-2">LMN</span>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[var(--text-dim)] font-medium uppercase tracking-wider">Address</label>
                            <div className="font-mono text-sm text-[var(--text-muted)] break-all bg-surfaceHighlight p-2 rounded border border-border">{activeKeys.address}</div>
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

    /* 2. Backup View (generated) */
    if (view === 'generated' && tempWallet) {
        return (
            <div className="flex flex-col h-full p-2 animate-fade-in space-y-4 overflow-y-auto">
                <div className="text-center">
                    <div className="w-12 h-12 bg-primary/20 rounded-full mx-auto mb-2 flex items-center justify-center text-primary">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Backup Your Wallet</h2>
                    <p className="text-xs text-red-500 mt-1">You must save BOTH keys. We cannot recover them.</p>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)]">1. Mnemonic Phrase (Secret)</label>
                    <div className="bg-surfaceHighlight/5 border border-border rounded-xl p-4">
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {tempWallet.mnemonic.split(' ').map((word, i) => (
                                <div key={i} className="bg-surface border border-white/5 hover:border-primary/30 transition-colors rounded-lg px-3 py-2 flex gap-3 items-center group relative overflow-hidden">
                                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <span className="text-[10px] text-[var(--text-dim)] font-mono select-none w-5 text-right relative z-10">{i + 1}.</span>
                                    <span className="text-sm font-bold text-foreground tracking-wide relative z-10">{word}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => navigator.clipboard.writeText(tempWallet.mnemonic)}
                            className="w-full py-3 bg-surface border border-border hover:bg-surfaceHighlight rounded-xl text-xs font-bold text-primary transition-all flex items-center justify-center gap-2 group"
                        >
                            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            Copy Mnemonic Phrase
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)]">2. PQC Key File (Public Identity)</label>
                    <div className="bg-surfaceHighlight border border-border rounded-xl p-3 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-foreground max-w-[150px] truncate">
                                {tempWallet.pqcKey?.name || (tempWallet as any).pqc?.name || 'PQC Key'}
                            </p>
                            <p className="text-[10px] text-[var(--text-dim)] font-mono">Dilithium3</p>
                        </div>
                        <button
                            onClick={() => {
                                const keyData = tempWallet.pqcKey || (tempWallet as any).pqc;
                                const exportData = {
                                    pqcKey: {
                                        ...keyData,
                                        /* Convert Hex -> Base64 for consistent export format */
                                        publicKey: Buffer.from(keyData.publicKey, 'hex').toString('base64'),
                                        privateKey: Buffer.from(keyData.privateKey, 'hex').toString('base64')
                                    }
                                };
                                downloadFile(JSON.stringify(exportData, null, 2), `lumen-pqc-${tempWallet.address.slice(0, 8)}.json`);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${hasDownloaded ? 'bg-green-500/20 text-green-500' : 'bg-primary text-white hover:bg-primary/90'}`}
                        >
                            {hasDownloaded ? 'Downloaded' : 'Download JSON'}
                        </button>
                    </div>
                </div>

                <div className="flex-1"></div>

                <button
                    onClick={confirmBackup}
                    className="w-full bg-surface border border-border hover:bg-surfaceHighlight text-foreground font-medium py-3 rounded-xl transition-all"
                >
                    I Have Saved Both
                </button>
            </div>
        );
    }

    /* 3. Verify Mnemonic Logic */
    if (view === 'verify-mnemonic' && tempWallet) {
        return (
            <div className="flex flex-col h-full p-4 animate-fade-in space-y-6">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-primary/20 rounded-full mx-auto flex items-center justify-center text-primary">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Verify Mnemonic</h2>
                    <p className="text-xs text-[var(--text-muted)]">Enter the following words from your phrase to confirm you saved them.</p>
                </div>

                <div className="space-y-4">
                    {verifyIndices.map((idx, i) => (
                        <div key={idx} className="space-y-1.5">
                            <label className="text-xs font-bold text-[var(--text-muted)] ml-1">Word #{idx + 1}</label>
                            <input
                                type="text"
                                value={verifyGuesses[i]}
                                onChange={(e) => {
                                    const newGuesses = [...verifyGuesses];
                                    newGuesses[i] = e.target.value;
                                    setVerifyGuesses(newGuesses);
                                    setError(null);
                                }}
                                placeholder={`Enter word #${idx + 1}`}
                                className="w-full bg-surface border border-border rounded-xl p-3 text-foreground text-sm font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:font-normal"
                            />
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                        <p className="text-red-500 text-xs font-medium">{error}</p>
                    </div>
                )}

                <div className="flex-1"></div>

                <div className="flex gap-3">
                    <button
                        onClick={() => setView('generated')}
                        className="flex-1 py-3 rounded-xl font-bold text-foreground bg-surfaceHighlight hover:bg-border transition-colors text-sm"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleVerifyKeys}
                        disabled={verifyGuesses.some(g => !g.trim())}
                        className="flex-1 py-3 rounded-xl font-bold text-white bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm shadow-lg shadow-primary/20"
                    >
                        Verify & Continue
                    </button>
                </div>
            </div>
        );
    }
    if (view === 'set-password') {
        return <SetPassword onConfirm={handleSetPassword} />;
    }

    /* 4. Initial Init View (Import/Create) */
    return (
        <div className="flex flex-col h-full justify-center p-2 animate-fade-in relative">
            {isAdding && onCancel && (
                <button
                    onClick={onCancel}
                    className="absolute top-0 left-0 p-2 text-[var(--text-muted)] hover:text-foreground transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
            )}
            <div className="text-center mb-8 relative z-10">
                <div className="relative w-20 h-20 mx-auto mb-4 group">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:bg-primary/30 transition-all duration-500"></div>
                    <img src="/icons/logo.png" alt="Lumen Wallet" className="w-full h-full object-contain relative z-10 drop-shadow-2xl" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-1 tracking-tight font-display">Lumen Wallet</h2>
                <p className="text-[var(--text-muted)] text-xs tracking-wide uppercase font-medium">Dual-Signer Architecture</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)] ml-1">1. Mnemonic Phrase</label>
                    <textarea
                        value={mnemonicInput}
                        onChange={(e) => setMnemonicInput(e.target.value)}
                        placeholder="Enter 24 words..."
                        className="w-full bg-surface border border-border rounded-xl p-4 text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-[var(--text-dim)] resize-none h-24"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-[var(--text-muted)] ml-1">2. PQC Key Data</label>
                        <div className="flex bg-surfaceHighlight rounded-lg p-0.5 border border-border">
                            <button
                                onClick={() => {
                                    setImportMode('file');
                                    setPqcKeyFile(null);
                                    setPqcCodeInput('');
                                    setError(null);
                                }}
                                className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${importMode === 'file' ? 'bg-primary text-white shadow' : 'text-[var(--text-muted)] hover:text-foreground'}`}
                            >
                                File
                            </button>
                            <button
                                onClick={() => {
                                    setImportMode('code');
                                    setPqcKeyFile(null);
                                    // Don't clear file input ref (native), but state is cleared
                                    setError(null);
                                }}
                                className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${importMode === 'code' ? 'bg-primary text-white shadow' : 'text-[var(--text-muted)] hover:text-foreground'}`}
                            >
                                Paste
                            </button>
                        </div>
                    </div>

                    {importMode === 'file' ? (
                        <div className={`relative border border-dashed rounded-xl p-4 transition-colors ${pqcKeyFile ? 'border-green-500/50 bg-green-500/5' : 'border-border hover:border-[var(--text-dim)] bg-surface'}`}>
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center justify-center text-center gap-2">
                                {pqcKeyFile ? (
                                    <>
                                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                        <span className="text-xs text-green-500 font-medium">Valid Dilithium3 Key</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        <span className="text-xs text-[var(--text-muted)]">Upload <span className="text-foreground font-medium">lumen-pqc-key.json</span></span>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                            <textarea
                                value={pqcCodeInput}
                                onChange={handleCodePaste}
                                placeholder='Paste JSON content here: {"scheme":"dilithium3", ...}'
                                className={`w-full bg-surface border rounded-xl p-4 text-foreground text-xs font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-[var(--text-dim)] resize-none h-24 ${pqcKeyFile ? 'border-green-500/50' : (pqcCodeInput && !pqcKeyFile ? 'border-red-500/50' : 'border-border')}`}
                            />
                            {pqcKeyFile && (
                                <div className="absolute bottom-2 right-2 text-[10px] text-green-500 font-bold bg-green-500/10 px-2 py-1 rounded">Valid JSON</div>
                            )}
                            {pqcCodeInput && !pqcKeyFile && (
                                <div className="absolute bottom-2 right-2 text-[10px] text-red-500 font-bold bg-red-500/10 px-2 py-1 rounded">
                                    {jsonError || 'Invalid Format'}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <button
                    onClick={handleImport}
                    disabled={!mnemonicInput || !pqcKeyFile || isLoading}
                    className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3.5 rounded-xl transition-all shadow-lg shadow-primary/20"
                >
                    {isLoading ? 'Importing...' : 'Import Wallet'}
                </button>

                <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                    <div className="relative flex justify-center"><span className="px-4 bg-background text-xs text-[var(--text-muted)] uppercase font-medium">Or</span></div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full bg-surface border border-border hover:bg-surfaceHighlight text-foreground font-medium py-3.5 rounded-xl transition-all"
                >
                    Create New Wallet
                </button>
            </div>

            {error && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                    <p className="text-red-500 text-xs leading-relaxed">{error}</p>
                </div>
            )}
        </div>
    );
};
