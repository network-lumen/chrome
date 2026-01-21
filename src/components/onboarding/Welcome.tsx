import React from 'react';

interface WelcomeProps {
    onCreateNew: () => void;
    onImportExisting: () => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onCreateNew, onImportExisting }) => {
    return (
        <div className="flex flex-col h-full justify-between p-8 animate-fade-in bg-gradient-to-b from-background via-background to-surface">
            {/* Hero Section */}
            <div className="flex-1 flex flex-col justify-center">
                <div className="text-center mb-12">
                    {/* Logo with glow effect */}
                    <div className="relative w-32 h-32 mx-auto mb-8 group">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary via-lumen to-primary-light rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-all duration-700 animate-pulse-slow"></div>
                        <img 
                            src="/icons/logo.png" 
                            alt="Lumen Wallet" 
                            className="w-full h-full object-contain relative z-10 transform group-hover:scale-110 transition-transform duration-500" 
                        />
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl font-bold text-foreground mb-3 font-display tracking-tight">
                        Welcome to Lumen
                    </h1>
                    <p className="text-[var(--text-muted)] text-base leading-relaxed max-w-sm mx-auto">
                        Your gateway to the Lumen blockchain with quantum-resistant security
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 gap-4 mb-8 max-w-md mx-auto">
                    <div className="flex items-start gap-4 p-4 bg-surface/50 border border-border rounded-xl hover:border-primary/50 transition-all group">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-light rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-foreground mb-1">Quantum-Resistant</h3>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                Protected with post-quantum cryptography (Dilithium3)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-surface/50 border border-border rounded-xl hover:border-primary/50 transition-all group">
                        <div className="w-10 h-10 bg-gradient-to-br from-lumen to-primary rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-foreground mb-1">Fast & Secure</h3>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                Lightning-fast transactions with enterprise-grade security
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-surface/50 border border-border rounded-xl hover:border-primary/50 transition-all group">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-light to-lumen rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h3 className="font-semibold text-foreground mb-1">Your Keys, Your Crypto</h3>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                Non-custodial wallet with full control over your assets
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
                <button
                    onClick={onCreateNew}
                    className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-hover hover:to-primary text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    Create New Wallet
                </button>

                <button
                    onClick={onImportExisting}
                    className="w-full bg-surface hover:bg-surfaceHighlight border-2 border-border hover:border-primary/50 text-foreground font-semibold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    Import Existing Wallet
                </button>

                {/* Terms */}
                <p className="text-xs text-[var(--text-muted)] text-center leading-relaxed px-4 pt-2">
                    By continuing, you agree to our{' '}
                    <a href="#" className="text-primary hover:underline">Terms of Service</a>
                    {' '}and{' '}
                    <a href="#" className="text-primary hover:underline">Privacy Policy</a>
                </p>
            </div>
        </div>
    );
};
