import React, { useState } from 'react';

interface UnlockProps {
    onUnlock: (password: string) => void;
    error?: string | null;
}

export const Unlock: React.FC<UnlockProps> = ({ onUnlock, error }) => {
    const [password, setPassword] = useState('');

    return (
        <div className="flex flex-col h-full justify-center p-6 animate-fade-in">
            <div className="text-center mb-10 relative z-10">
                <div className="relative w-24 h-24 mx-auto mb-6 group">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/40 transition-all duration-700 animate-pulse-slow"></div>
                    <img src="/icons/logo.png" alt="Lumen Wallet" className="w-full h-full object-contain relative z-10 drop-shadow-2xl translate-y-0 group-hover:-translate-y-1 transition-transform duration-500" />
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-2 font-display tracking-tight">Welcome Back</h2>
                <p className="text-[var(--text-muted)] text-sm font-medium">Session Locked</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-muted)] ml-1">Extension Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onUnlock(password)}
                        className="w-full bg-surface border border-border rounded-xl p-4 text-foreground focus:border-primary outline-none transition-all"
                        placeholder="Enter password..."
                        autoFocus
                    />
                </div>

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs text-center">
                        {error}
                    </div>
                )}

                <button
                    onClick={() => onUnlock(password)}
                    disabled={!password}
                    className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-primary/20"
                >
                    Unlock Wallet
                </button>
            </div>
        </div>
    );
};
