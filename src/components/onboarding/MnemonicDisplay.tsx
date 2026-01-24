import React, { useState } from 'react';
import type { PqcKeyData } from '../../types/wallet';

interface MnemonicDisplayProps {
    mnemonic: string;
    pqcKey: PqcKeyData;
    address: string;
    onConfirm: () => void;
    onBack: () => void;
}

export const MnemonicDisplay: React.FC<MnemonicDisplayProps> = ({ mnemonic, pqcKey, address, onConfirm, onBack }) => {
    const [copied, setCopied] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const words = mnemonic.split(' ');

    const handleCopy = () => {
        navigator.clipboard.writeText(mnemonic);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadPqcBackup = () => {
        const data = JSON.stringify({ pqcKey: pqcKey }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lumen_pqc_${address.substring(0, 8)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full justify-between p-8 animate-fade-in overflow-y-auto">
            <div className="flex-1">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
                        <div className="relative w-full h-full bg-gradient-to-br from-primary to-primary-light rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Secret Recovery Phrase</h2>
                    <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-sm mx-auto">
                        Write down these 24 words in order and store them safely
                    </p>
                </div>

                {/* Warning Banner */}
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="text-xs text-red-400 leading-relaxed">
                            <p className="font-semibold mb-1">Never share your recovery phrase!</p>
                            <ul className="space-y-1 list-disc list-inside">
                                <li>Anyone with this phrase can access your funds</li>
                                <li>Store both mnemonic and PQC keys offline securely</li>
                                <li>PQC keys cannot be recovered from mnemonic alone</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Mnemonic Grid */}
                <div className="mb-6 p-6 bg-surface border-2 border-border rounded-xl">
                    <div className="grid grid-cols-2 gap-3">
                        {words.map((word, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border"
                            >
                                <span className="text-xs font-bold text-[var(--text-muted)] w-6">{index + 1}.</span>
                                <span className="font-mono text-sm text-foreground font-semibold">{word}</span>
                            </div>
                        ))}
                    </div>

                    {/* Copy Button */}
                    <button
                        onClick={handleCopy}
                        className="w-full mt-4 py-3 bg-background hover:bg-surfaceHighlight border border-border rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-semibold text-foreground"
                    >
                        {copied ? (
                            <>
                                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy Mnemonic
                            </>
                        )}
                    </button>
                </div>

                {/* PQC Section */}
                <div className="mb-6 space-y-3">
                    <div className="flex items-center justify-between ml-1">
                        <label className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">PQC Key Data (JSON)</label>
                        <span className="text-[10px] text-primary font-bold">Recommended Backup</span>
                    </div>
                    <div className="p-4 bg-surface border border-border rounded-xl space-y-4">
                        <div className="bg-black/20 border border-border rounded-lg p-3 text-[8px] font-mono break-all leading-tight max-h-24 overflow-y-auto whitespace-pre-wrap">
                            {JSON.stringify({ pqcKey: pqcKey }, null, 2)}
                        </div>
                        <button
                            onClick={downloadPqcBackup}
                            className="w-full py-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg transition-all flex items-center justify-center gap-2 text-xs font-bold text-primary"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download PQC Backup JSON
                        </button>
                    </div>
                </div>

                {/* Confirmation Checkbox */}
                <label className="flex items-start gap-3 p-4 bg-surface/50 border border-border rounded-xl cursor-pointer hover:border-primary/50 transition-all">
                    <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded border-2 border-border bg-background checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/50 cursor-pointer"
                    />
                    <div className="text-sm text-[var(--text-muted)] leading-relaxed">
                        <p className="font-semibold text-foreground mb-1">I have saved my mnemonic and PQC key data</p>
                        <p className="text-xs">I understand that I need both to fully restore my wallet functions (PQC features) in the future.</p>
                    </div>
                </label>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mt-6">
                <button
                    onClick={onConfirm}
                    disabled={!confirmed}
                    className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-hover hover:to-primary disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
                >
                    Continue
                </button>

                <button
                    onClick={onBack}
                    className="w-full text-[var(--text-muted)] hover:text-foreground font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
            </div>
        </div>
    );
};
