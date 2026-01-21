import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { LumenWallet } from '../../modules/sdk/key-manager';

interface BackupModalProps {
    wallet: LumenWallet;
    onClose: () => void;
}

import { VaultManager } from '../../modules/vault/vault';

export const BackupModal: React.FC<BackupModalProps> = ({ wallet, onClose }) => {
    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Backup View State
    const [showMnemonic, setShowMnemonic] = useState(false);
    const [showPqc, setShowPqc] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    const handleVerifyParams = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setVerifying(true);
            setError(null);
            // Verify by attempting to unlock vault
            await VaultManager.unlock(password);
            setIsAuthenticated(true);
        } catch (err: any) {
            setError("Incorrect password");
        } finally {
            setVerifying(false);
        }
    };

    /* Robustly find PQC data */
    const findPqcData = () => {
        /* 1. Check primary standard location (and ensure it has privateKey) */
        if (wallet.pqcKey && wallet.pqcKey.privateKey) return wallet.pqcKey;

        /* 2. Check legacy location */
        if ((wallet as any).pqc && (wallet as any).pqc.privateKey) return (wallet as any).pqc;

        /* 3. Scan all properties for a valid PQC object (recovery mode) */
        /* This handles cases where data might be shifted or under a different key */
        for (const key of Object.keys(wallet)) {
            const val = (wallet as any)[key];
            if (val && typeof val === 'object' && (val as any).scheme === 'dilithium3' && (val as any).privateKey) {
                return val;
            }
        }

        /* 4. Fallback (even if broken, return it so user sees something) */
        return wallet.pqcKey || (wallet as any).pqc;
    };

    const pqcSource = findPqcData();

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    };

    const downloadBackup = () => {
        const data = JSON.stringify({ pqcKey: pqcSource }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lumen_pqc_${wallet.address.substring(0, 8)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const modalContent = (
        <div className="fixed inset-0 z-[99999] bg-background/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in text-left" onClick={onClose} style={{ margin: 0, left: 0, right: 0, top: 0, bottom: 0 }}>
            {!isAuthenticated ? (
                <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-foreground">Unlock Backup</h3>
                        <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" /></svg>
                        </button>
                    </div>

                    <form onSubmit={handleVerifyParams} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Enter Password</label>
                            <input
                                type="password"
                                autoFocus
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground outline-none focus:border-primary transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <p className="text-red-500 text-xs font-medium text-center">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!password || verifying}
                            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                        >
                            {verifying ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                "Confirm Password"
                            )}
                        </button>
                    </form>
                </div>
            ) : (
                <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-slide-up flex flex-col max-h-[90vh]">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-foreground">Secure Backup</h3>
                        <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" /></svg>
                        </button>
                    </div>

                    <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                        <section className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Mnemonic Phrase</label>
                                <button
                                    onClick={() => setShowMnemonic(!showMnemonic)}
                                    className="text-[10px] text-primary hover:underline font-bold"
                                >
                                    {showMnemonic ? 'Hide' : 'Reveal'}
                                </button>
                            </div>
                            <div className="relative group">
                                <div className={`bg-black/20 border border-border rounded-xl p-4 text-xs font-mono leading-relaxed transition-all ${!showMnemonic ? 'blur-sm select-none' : ''}`}>
                                    {wallet.mnemonic}
                                </div>
                                {showMnemonic && (
                                    <button
                                        onClick={() => handleCopy(wallet.mnemonic, 'Mnemonic')}
                                        className="absolute top-2 right-2 p-1.5 bg-surface rounded-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                    </button>
                                )}
                            </div>
                        </section>

                        <section className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">PQC Key Data (JSON)</label>
                                <button
                                    onClick={() => setShowPqc(!showPqc)}
                                    className="text-[10px] text-primary hover:underline font-bold"
                                >
                                    {showPqc ? 'Hide' : 'Reveal'}
                                </button>
                            </div>
                            <div className="relative group">
                                <div className={`bg-black/20 border border-border rounded-xl p-3 text-[9px] font-mono break-all leading-tight max-h-32 overflow-y-auto whitespace-pre-wrap transition-all ${!showPqc ? 'blur-sm select-none' : ''}`}>
                                    {JSON.stringify({ pqcKey: pqcSource }, null, 2)}
                                </div>
                                {showPqc && (
                                    <button
                                        onClick={() => handleCopy(JSON.stringify({ pqcKey: pqcSource }, null, 2), 'PQC Data')}
                                        className="absolute top-2 right-2 p-1.5 bg-surface rounded-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                    </button>
                                )}
                            </div>
                        </section>

                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 items-start">
                            <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <p className="text-[10px] text-amber-500 leading-normal">
                                NEVER share these keys with anyone. Anyone with your mnemonic or private key can steal your funds.
                            </p>
                        </div>
                    </div>

                    <div className="pt-6 space-y-3">
                        <button
                            onClick={downloadBackup}
                            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download JSON Backup
                        </button>
                        {copied && (
                            <p className="text-center text-[10px] font-bold text-primary animate-bounce">Copied {copied}!</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    return createPortal(modalContent, document.body);
};
