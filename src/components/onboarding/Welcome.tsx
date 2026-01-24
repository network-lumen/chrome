import React from 'react';

interface WelcomeProps {
    onCreateNew: () => void;
    onImportExisting: () => void;
    onBack?: () => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onCreateNew, onImportExisting, onBack }) => {
    return (
        <div className="flex flex-col items-center justify-start w-full min-h-screen animate-fade-in bg-gradient-to-b from-background via-background to-surface overflow-y-auto">
            <div className="w-full max-w-lg mx-auto flex flex-col items-center py-16 px-8 my-auto">
                {/* Header */}
                <div className="text-center mb-12 w-full">
                    {/* Logo with enhanced glow */}
                    <div className="relative w-28 h-28 mx-auto mb-8 group">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary via-lumen to-primary-light rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition-all duration-700 animate-pulse-slow"></div>
                        <img
                            src="/icons/logo.png"
                            alt="Lumen Wallet"
                            className="w-full h-full object-contain relative z-10 transform group-hover:scale-105 transition-transform duration-500"
                        />
                    </div>

                    {/* Title and Subtitle */}
                    <h1 className="text-4xl font-bold text-foreground mb-4 font-display tracking-tight text-center">
                        Welcome to Lumen
                    </h1>
                    <p className="text-[var(--text-muted)] text-base leading-relaxed max-w-sm mx-auto text-center px-4">
                        The most secure and user-friendly wallet for the Lumen blockchain
                    </p>
                </div>

                {/* Features - 2 Column Grid */}
                <div className="grid grid-cols-2 gap-3 mb-10 w-full px-2">
                    <div className="flex flex-col items-center gap-2 p-4 bg-surface/30 border border-border/50 rounded-2xl hover:border-primary/40 transition-all group text-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-light rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-lg shadow-primary/10 mb-1">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h3 className="font-semibold text-foreground text-sm">Quantum Safe</h3>
                        <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                            Post-quantum cryptography
                        </p>
                    </div>

                    <div className="flex flex-col items-center gap-2 p-4 bg-surface/30 border border-border/50 rounded-2xl hover:border-primary/40 transition-all group text-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-lumen to-primary rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-lg shadow-primary/10 mb-1">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="font-semibold text-foreground text-sm">Fast & Secure</h3>
                        <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                            Enterprise-grade security
                        </p>
                    </div>

                    <div className="col-span-2 flex items-center gap-4 p-4 bg-surface/30 border border-border/50 rounded-2xl hover:border-primary/40 transition-all group">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-light to-lumen rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-lg shadow-primary/10">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-foreground text-sm">Non-Custodial</h3>
                            <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                                Your keys, your crypto. Full control over your assets.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-4 w-full">
                    <button
                        onClick={onCreateNew}
                        className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] text-base group overflow-hidden relative"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            Create New Wallet
                            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                    </button>

                    <button
                        onClick={onImportExisting}
                        className="w-full bg-surface/50 hover:bg-surfaceHighlight border-2 border-border/60 hover:border-primary/40 text-primary font-bold py-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] text-base"
                    >
                        Import Existing Wallet
                    </button>

                    {onBack && (
                        <button
                            onClick={onBack}
                            className="w-full py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-primary transition-colors flex items-center justify-center gap-2 group/back"
                        >
                            <svg className="w-4 h-4 group-hover/back:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Dashboard
                        </button>
                    )}

                    {/* Footer Links */}
                    <p className="text-[10px] text-[var(--text-muted)] text-center leading-relaxed px-4 pt-4">
                        By continuing, you agree to our{' '}
                        <a href="#" className="text-primary hover:underline font-medium">Terms</a>
                        {' '}and{' '}
                        <a href="#" className="text-primary hover:underline font-medium">Privacy Policy</a>
                    </p>
                </div>
            </div>
        </div>
    );
};
