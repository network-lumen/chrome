import React, { useState } from 'react';

interface ImportWalletProps {
    onImport: (mnemonic: string) => void;
    onBack: () => void;
}

export const ImportWallet: React.FC<ImportWalletProps> = ({ onImport, onBack }) => {
    const [mnemonic, setMnemonic] = useState('');
    const [error, setError] = useState('');

    const handleImport = () => {
        const words = mnemonic.trim().split(/\s+/);
        
        // Validate word count (12 or 24 words)
        if (words.length !== 12 && words.length !== 24) {
            setError('Recovery phrase must be 12 or 24 words');
            return;
        }

        // Basic validation - check if all words are present
        if (words.some(word => !word || word.length < 2)) {
            setError('Invalid recovery phrase format');
            return;
        }

        onImport(mnemonic.trim());
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setMnemonic(text);
            setError('');
        } catch (err) {
            setError('Failed to paste from clipboard');
        }
    };

    const wordCount = mnemonic.trim().split(/\s+/).filter(w => w).length;

    return (
        <div className="flex flex-col h-full justify-between p-8 animate-fade-in overflow-y-auto">
            <div className="flex-1">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
                        <div className="relative w-full h-full bg-gradient-to-br from-lumen to-primary-light rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Import Wallet</h2>
                    <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-sm mx-auto">
                        Enter your 12 or 24-word recovery phrase to restore your wallet
                    </p>
                </div>

                {/* Warning Banner */}
                <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="text-xs text-yellow-400 leading-relaxed">
                            <p className="font-semibold mb-1">Security Warning</p>
                            <p>Never share your recovery phrase with anyone. Lumen will never ask for it.</p>
                        </div>
                    </div>
                </div>

                {/* Mnemonic Input */}
                <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-[var(--text-muted)] ml-1 uppercase tracking-wide">
                            Recovery Phrase
                        </label>
                        <span className={`text-xs font-semibold ${
                            wordCount === 12 || wordCount === 24 ? 'text-green-500' : 'text-[var(--text-muted)]'
                        }`}>
                            {wordCount} words
                        </span>
                    </div>
                    <div className="relative">
                        <textarea
                            value={mnemonic}
                            onChange={(e) => {
                                setMnemonic(e.target.value);
                                setError('');
                            }}
                            placeholder="Enter your recovery phrase separated by spaces"
                            className="w-full bg-surface border-2 border-border rounded-xl p-4 text-foreground focus:border-primary outline-none transition-all placeholder:text-[var(--text-dim)] font-mono text-sm resize-none"
                            rows={6}
                            autoFocus
                        />
                        <button
                            onClick={handlePaste}
                            className="absolute top-3 right-3 p-2 bg-background hover:bg-surfaceHighlight border border-border rounded-lg transition-all text-xs font-semibold text-foreground flex items-center gap-1"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Paste
                        </button>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 animate-fade-in">
                        <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {/* Info Box */}
                <div className="p-4 bg-surface/50 border border-border rounded-xl">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                            <p className="font-semibold text-foreground mb-1">Import Tips</p>
                            <ul className="space-y-1 list-disc list-inside">
                                <li>Separate each word with a space</li>
                                <li>Words should be in lowercase</li>
                                <li>Double-check for typos</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mt-6">
                <button
                    onClick={handleImport}
                    disabled={!mnemonic.trim()}
                    className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-hover hover:to-primary disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
                >
                    Import Wallet
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
