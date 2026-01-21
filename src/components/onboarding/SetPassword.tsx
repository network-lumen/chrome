import React, { useState } from 'react';

interface SetPasswordProps {
    onConfirm: (password: string) => void;
}

export const SetPassword: React.FC<SetPasswordProps> = ({ onConfirm }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Password strength indicator
    const getPasswordStrength = (pwd: string) => {
        if (pwd.length === 0) return { strength: 0, label: '', color: '' };
        if (pwd.length < 6) return { strength: 1, label: 'Too Short', color: 'bg-red-500' };
        if (pwd.length < 8) return { strength: 2, label: 'Weak', color: 'bg-orange-500' };
        if (pwd.length < 12) return { strength: 3, label: 'Good', color: 'bg-yellow-500' };
        return { strength: 4, label: 'Strong', color: 'bg-green-500' };
    };

    const strength = getPasswordStrength(password);

    const handleSubmit = () => {
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (password !== confirm) {
            setError("Passwords do not match.");
            return;
        }
        onConfirm(password);
    };

    return (
        <div className="flex flex-col h-full justify-between p-8 animate-fade-in">
            <div className="flex-1 flex flex-col justify-center">
                <div className="text-center mb-8">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
                        <div className="relative w-full h-full bg-gradient-to-br from-primary to-primary-light rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Secure Your Wallet</h2>
                    <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-sm mx-auto">
                        Create a strong password to encrypt your wallet. This password is stored locally and cannot be recovered.
                    </p>
                </div>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-[var(--text-muted)] ml-1 uppercase tracking-wide">New Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setError('');
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && confirm && handleSubmit()}
                                className="w-full bg-surface border-2 border-border rounded-xl p-4 pr-12 text-foreground focus:border-primary outline-none transition-all placeholder:text-[var(--text-dim)]"
                                placeholder="Enter password"
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
                        
                        {/* Password Strength Indicator */}
                        {password && (
                            <div className="space-y-1.5 mt-2">
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4].map((level) => (
                                        <div
                                            key={level}
                                            className={`h-1 flex-1 rounded-full transition-all ${
                                                level <= strength.strength ? strength.color : 'bg-border'
                                            }`}
                                        />
                                    ))}
                                </div>
                                {strength.label && (
                                    <p className="text-xs text-[var(--text-muted)] ml-1">
                                        Password strength: <span className="font-semibold">{strength.label}</span>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-[var(--text-muted)] ml-1 uppercase tracking-wide">Confirm Password</label>
                        <div className="relative">
                            <input
                                type={showConfirm ? "text" : "password"}
                                value={confirm}
                                onChange={(e) => {
                                    setConfirm(e.target.value);
                                    setError('');
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && password && handleSubmit()}
                                className="w-full bg-surface border-2 border-border rounded-xl p-4 pr-12 text-foreground focus:border-primary outline-none transition-all placeholder:text-[var(--text-dim)]"
                                placeholder="Confirm password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-foreground transition-colors"
                            >
                                {showConfirm ? (
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
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
                        <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {/* Security Notice */}
                <div className="mt-6 p-4 bg-surface/50 border border-border rounded-xl">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-primary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                            <p className="font-semibold text-foreground mb-1">Important Security Notice</p>
                            <ul className="space-y-1 list-disc list-inside">
                                <li>This password encrypts your wallet locally</li>
                                <li>We cannot recover or reset your password</li>
                                <li>Use a strong, unique password</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <button
                onClick={handleSubmit}
                disabled={!password || !confirm || password.length < 6}
                className="w-full bg-gradient-to-r from-primary to-primary-light hover:from-primary-hover hover:to-primary disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
            >
                Secure Wallet
            </button>
        </div>
    );
};
