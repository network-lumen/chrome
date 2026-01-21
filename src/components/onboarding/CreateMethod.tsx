import React from 'react';

interface CreateMethodProps {
    onSelectMnemonic: () => void;
    onSelectImport: () => void;
    onBack: () => void;
}

export const CreateMethod: React.FC<CreateMethodProps> = ({ onSelectMnemonic, onSelectImport, onBack }) => {
    return (
        <div className="flex flex-col h-full justify-between p-8 animate-fade-in">
            <div className="flex-1 flex flex-col justify-center">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="relative w-16 h-16 mx-auto mb-6">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
                        <div className="relative w-full h-full bg-gradient-to-br from-primary to-primary-light rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Create New Wallet</h2>
                    <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-sm mx-auto">
                        Choose how you'd like to create your wallet
                    </p>
                </div>

                {/* Options */}
                <div className="space-y-4 max-w-md mx-auto w-full">
                    {/* Mnemonic Option */}
                    <button
                        onClick={onSelectMnemonic}
                        className="w-full p-6 bg-surface border-2 border-border hover:border-primary rounded-xl transition-all text-left group hover:scale-[1.02] active:scale-[0.98] transform"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-light rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-foreground mb-1 text-lg">Create with Mnemonic</h3>
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-2">
                                    Generate a new 24-word recovery phrase
                                </p>
                                <div className="flex items-center gap-2 text-xs text-primary font-medium">
                                    <span>Recommended for new users</span>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </button>

                    {/* Import Option */}
                    <button
                        onClick={onSelectImport}
                        className="w-full p-6 bg-surface border-2 border-border hover:border-primary rounded-xl transition-all text-left group hover:scale-[1.02] active:scale-[0.98] transform"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-lumen to-primary-light rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-foreground mb-1 text-lg">Import Existing Wallet</h3>
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-2">
                                    Restore from recovery phrase or private key
                                </p>
                                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-medium">
                                    <span>For existing wallet users</span>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Info Box */}
                <div className="mt-8 p-4 bg-surface/50 border border-border rounded-xl max-w-md mx-auto w-full">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                            <p className="font-semibold text-foreground mb-1">Security Notice</p>
                            <p>Your recovery phrase is the only way to restore your wallet. Keep it safe and never share it with anyone.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Back Button */}
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
    );
};
