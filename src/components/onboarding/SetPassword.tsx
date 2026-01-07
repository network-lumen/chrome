import React, { useState } from 'react';

interface SetPasswordProps {
    onConfirm: (password: string) => void;
}

export const SetPassword: React.FC<SetPasswordProps> = ({ onConfirm }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');

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
        <div className="flex flex-col h-full justify-center p-6 animate-fade-in">
            <div className="text-center mb-6">
                <div className="w-12 h-12 bg-primary/20 rounded-full mx-auto mb-4 flex items-center justify-center text-primary">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Set Wallet Password</h2>
                <p className="text-gray-400 text-xs leading-relaxed">
                    This password encrypts your keys on this device. We cannot recover it if lost.
                </p>
            </div>

            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">New Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary outline-none transition-all"
                        placeholder="••••••••"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">Confirm Password</label>
                    <input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary outline-none transition-all"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            {error && <p className="text-red-400 text-xs mt-4 text-center">{error}</p>}

            <button
                onClick={handleSubmit}
                disabled={!password || !confirm}
                className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all mt-8 shadow-lg shadow-primary/20"
            >
                Set Password & Encrypt
            </button>
        </div>
    );
};
