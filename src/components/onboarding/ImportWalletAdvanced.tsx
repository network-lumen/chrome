import React, { useState } from 'react';
import type { PqcKeyData } from '../../modules/sdk/key-manager';

interface ImportWalletAdvancedProps {
    onImport: (mnemonic: string, pqcKey: PqcKeyData) => void;
    onGenerateFreshPqc: (mnemonic: string) => void;
    onBack: () => void;
    isLoading?: boolean;
    error?: string | null;
}

export const ImportWalletAdvanced: React.FC<ImportWalletAdvancedProps> = ({ onImport, onGenerateFreshPqc, onBack, isLoading, error: externalError }) => {
    const [mnemonic, setMnemonic] = useState('');
    const [pqcKeyFile, setPqcKeyFile] = useState<PqcKeyData | null>(null);
    const [pqcOption, setPqcOption] = useState<'existing' | 'fresh'>('existing');
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
                    setJsonError(null);
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

        if (pqcOption === 'fresh') {
            onGenerateFreshPqc(mnemonic.trim());
            return;
        }

        if (!pqcKeyFile) {
            setError('Upload your PQC JSON or choose "Generate fresh post-quantum-resistant keys".');
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
                        Import your wallet with your recovery phrase and post-quantum security
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
                            2. Post-Quantum Security
                        </label>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                            {pqcOption === 'existing' ? 'Import existing keys' : 'Generate new keys'}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setPqcOption('existing');
                            setError('');
                            setJsonError(null);
                        }}
                        className={`w-full rounded-xl border p-4 text-left transition-all ${pqcOption === 'existing'
                            ? 'border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]'
                            : 'border-border bg-surface hover:border-[var(--text-dim)]'
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${pqcOption === 'existing' ? 'border-primary bg-primary text-white' : 'border-border text-transparent'}`}>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Upload existing post-quantum key JSON</p>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                    Use this if your wallet already has PQC keys and you exported a `lumen-pqc-key.json` file.
                                </p>
                            </div>
                        </div>
                    </button>

                    <div className="flex items-center gap-3 px-1">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-dim)]">or</span>
                        <div className="h-px flex-1 bg-border" />
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setPqcOption('fresh');
                            setError('');
                            setJsonError(null);
                        }}
                        className={`w-full rounded-xl border p-4 text-left transition-all ${pqcOption === 'fresh'
                            ? 'border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]'
                            : 'border-border bg-surface hover:border-[var(--text-dim)]'
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${pqcOption === 'fresh' ? 'border-primary bg-primary text-white' : 'border-border text-transparent'}`}>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Generate fresh post-quantum-resistant keys</p>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                    Best for legacy wallets from Keplr and similar apps that do not already export PQC keys.
                                </p>
                            </div>
                        </div>
                    </button>

                    {pqcOption === 'existing' ? (
                        <>
                            <div className="flex bg-surfaceHighlight rounded-lg p-0.5 border border-border w-fit">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setImportMode('file');
                                        setPqcKeyFile(null);
                                        setPqcCodeInput('');
                                        setJsonError(null);
                                        setError('');
                                    }}
                                    className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${importMode === 'file' ? 'bg-primary text-white shadow' : 'text-[var(--text-muted)] hover:text-foreground'}`}
                                >
                                    File
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setImportMode('code');
                                        setPqcKeyFile(null);
                                        setJsonError(null);
                                        setError('');
                                    }}
                                    className={`px-2 py-0.5 text-[10px] rounded-md transition-all ${importMode === 'code' ? 'bg-primary text-white shadow' : 'text-[var(--text-muted)] hover:text-foreground'}`}
                                >
                                    Paste
                                </button>
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
                        </>
                    ) : (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-3.314 0-6 2.239-6 5 0 1.835 1.186 3.439 2.95 4.307L12 21l3.05-3.693C16.814 16.439 18 14.835 18 13c0-2.761-2.686-5-6-5z" /></svg>
                                </div>
                                <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                                    <p className="font-semibold text-foreground mb-1">Fresh post-quantum-resistant keys will be generated locally during import.</p>
                                    <p>This is the simplest path for non-post-quantum-resistant wallets from Keplr and similar apps.</p>
                                    <p className="mt-2 text-primary/90">After import, open wallet settings and tap <span className="font-semibold text-foreground">Link PQC Account</span> to register these keys on-chain.</p>
                                </div>
                            </div>
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
                                <li>Mnemonic must be 12 or 24 words</li>
                                <li>{pqcOption === 'existing' ? 'Existing PQC key must be Dilithium3 format' : 'Fresh Dilithium3 PQC keys will be generated locally for you'}</li>
                                <li>{pqcOption === 'existing' ? 'Use this path if you already exported a PQC JSON file' : 'Use this path for legacy wallets that do not already include PQC keys'}</li>
                                <li>{pqcOption === 'existing' ? 'Imported wallets keep their current PQC identity' : 'Fresh keys must be linked on-chain after import before sending transactions'}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mt-6">
                <button
                    onClick={handleImport}
                    disabled={!mnemonic.trim() || (pqcOption === 'existing' && !pqcKeyFile) || isLoading}
                    className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-hover hover:to-primary disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
                >
                    {isLoading ? (pqcOption === 'fresh' ? 'Generating PQC Keys...' : 'Importing...') : (pqcOption === 'fresh' ? 'Import Wallet & Generate PQC Keys' : 'Import Wallet')}
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
