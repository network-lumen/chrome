import React, { useState } from 'react';
import type { PqcKeyData } from '../../modules/sdk/key-manager';

interface ImportWalletAdvancedProps {
    onImport: (mnemonic: string, pqcKey: PqcKeyData) => void;
    onBack: () => void;
    isLoading?: boolean;
    error?: string | null;
}

export const ImportWalletAdvanced: React.FC<ImportWalletAdvancedProps> = ({ onImport, onBack, isLoading, error: externalError }) => {
    const [mnemonic, setMnemonic] = useState('');
    const [pqcKeyFile, setPqcKeyFile] = useState<PqcKeyData | null>(null);
    const [importMode, setImportMode] = useState<'file' | 'code'>('file');
    const [pqcCodeInput, setPqcCodeInput] = useState('');
    const [error, setError] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);

    const parsePqcJson = (jsonString: string): PqcKeyData => {
        try {
            const sanitized = jsonString.replace(/\u00A0/g, ' ').trim();
            const json = JSON.parse(sanitized);

            // Handle nested structure
            if (json.pqcKey && json.pqcKey.scheme) {
                return json.pqcKey;
            }
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
                    setError('');
                } catch (err) {
                    setError("Invalid PQC JSON: " + (err as Error).message);
                    setPqcKeyFile(null);
                }
            };
            reader.readAsText(file);
        }
    };

    const handleCodePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setPqcCodeInput(val);
        setJsonError(null);

        if (!val.trim()) {
            setPqcKeyFile(null);
            return;
        }

        try {
            const data = parsePqcJson(val);
            setPqcKeyFile(data);
            setError('');
        } catch (err: any) {
            setPqcKeyFile(null);
            setJsonError(err.message);
        }
    };

    const handleImport = () => {
        const words = mnemonic.trim().split(/\s+/);

        if (words.length !== 12 && words.length !== 24) {
            setError('Recovery phrase must be 12 or 24 words');
            return;
        }

        if (!pqcKeyFile) {
            setError('PQC Key file is required');
            return;
        }

        onImport(mnemonic.trim(), pqcKeyFile);
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
                        Import your wallet with mnemonic phrase and PQC key
                    </p>
                </div>

                {/* Mnemonic Input */}
                <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-[var(--text-muted)] ml-1 uppercase tracking-wide">
                            1. Mnemonic Phrase
                        </label>
                        <span className={`text-xs font-semibold ${wordCount === 12 || wordCount === 24 ? 'text-green-500' : 'text-[var(--text-muted)]'
                            }`}>
                            {wordCount} words
                        </span>
                    </div>
                    <textarea
                        value={mnemonic}
                        onChange={(e) => {
                            setMnemonic(e.target.value);
                            setError('');
                        }}
                        placeholder="Enter your 12 or 24-word recovery phrase"
                        className="w-full bg-surface border-2 border-border rounded-xl p-4 text-foreground text-sm focus:border-primary outline-none transition-all placeholder:text-[var(--text-dim)] font-mono resize-none"
                        rows={4}
                        autoFocus
                    />
                </div>

                {/* PQC Key Input */}
                <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-[var(--text-muted)] ml-1 uppercase tracking-wide">
                            2. PQC Key Data
                        </label>
                        <div className="flex bg-surfaceHighlight rounded-lg p-0.5 border border-border">
                            <button
                                onClick={() => {
                                    setImportMode('file');
                                    setPqcKeyFile(null);
                                    setPqcCodeInput('');
                                    setError('');
                                }}
                                className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${importMode === 'file' ? 'bg-primary text-white shadow' : 'text-[var(--text-muted)] hover:text-foreground'}`}
                            >
                                File
                            </button>
                            <button
                                onClick={() => {
                                    setImportMode('code');
                                    setPqcKeyFile(null);
                                    setError('');
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
                                className={`w-full bg-surface border-2 rounded-xl p-4 text-foreground text-xs font-mono focus:border-primary outline-none transition-all placeholder:text-[var(--text-dim)] resize-none ${pqcKeyFile ? 'border-green-500/50' : (pqcCodeInput && !pqcKeyFile ? 'border-red-500/50' : 'border-border')}`}
                                rows={6}
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

                {/* Error Message */}
                {(error || externalError) && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 animate-fade-in">
                        <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-red-400 text-sm">{error || externalError}</p>
                    </div>
                )}

                {/* Info Box */}
                <div className="p-4 bg-surface/50 border border-border rounded-xl">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                            <p className="font-semibold text-foreground mb-1">Import Requirements</p>
                            <ul className="space-y-1 list-disc list-inside">
                                <li>Both mnemonic and PQC key are required</li>
                                <li>PQC key must be Dilithium3 format</li>
                                <li>Mnemonic must be 12 or 24 words</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mt-6">
                <button
                    onClick={handleImport}
                    disabled={!mnemonic.trim() || !pqcKeyFile || isLoading}
                    className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-hover hover:to-primary disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
                >
                    {isLoading ? 'Importing...' : 'Import Wallet'}
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
