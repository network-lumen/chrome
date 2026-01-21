import React, { useState } from 'react';

interface UnlockProps {
    onUnlock: (password: string) => void;
    error?: string | null;
}

export const Unlock: React.FC<UnlockProps> = ({ onUnlock, error }) => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="flex flex-col h-full justify-between p-8 animate-fade-in bg-gradient-to-b from-background via-background to-surface">
            <div className="flex-1 flex flex-col justify-center">
                <div className="text-center mb-10 relative z-10">
                    <div className="relative w-24 h-24 mx-auto mb-6 group">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary via-lumen to-primary-light rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition-all duration-700 animate-pulse-slow"></div>
                        <img 
                            src="/icons/logo.png" 
                            alt="Lumen Wallet" 
                            className="w-full h-full object-contain relative z-10 transform group-hover:scale-105 transition-transform duration-500" 
                        />
                    </div>
                    <h2 className="text-3xl font-bold text-foreground mb-2 font-display tracking-tight">Welcome Back</h2>
                    <p className="text-[var(--text-muted)] text-sm font-medium">Enter your password to unlock</p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-[var(--text-muted)] ml-1 uppercase tracking-wide">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && password && onUnlock(password)}
                                className="w-full bg-surface border-2 border-border rounded-xl p-4 pr-12 text-foreground focus:border-primary outline-none transition-all placeholder:text-[var(--text-dim)]"
                                placeholder="Enter your password"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-foreground transition-colors"
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 animate-fade-in">
                            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-red-400 text-sm font-medium">{error}</p>
                                <p className="text-red-400/70 text-xs mt-1">Please try again or reset your wallet</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <button
                    onClick={() => onUnlock(password)}
                    disabled={!password}
                    className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-hover hover:to-primary disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
                >
                    Unlock Wallet
                </button>

                <button
                    className="w-full text-[var(--text-muted)] hover:text-foreground text-sm font-medium py-2 transition-colors"
                >
                    Forgot Password?
                </button>
            </div>
        </div>
    );
};
